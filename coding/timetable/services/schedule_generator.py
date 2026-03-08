"""Comprehensive timetable solver with modular, toggleable constraints."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple, Optional, Iterable, Set, Callable
from collections import defaultdict

from ortools.sat.python import cp_model

Timeslot = Tuple[str, str, int]
ProgressCallback = Callable[[str, float, Optional[str], Optional[Dict[str, Any]]], None]


@dataclass(frozen=True)
class Lesson:
    """Represents a single hour inside a lesson block."""
    subject: str
    level: str
    class_name: str
    block_index: int
    offset: int
    block_size: int


@dataclass
class TeacherRecord:
    name: str
    subject: str
    levels: List[str]
    min_hours: int
    max_hours: int
    assigned_hours: int = 0
    active_hour_group_id: str = ""


@dataclass
class ConstraintConfig:
    class_contiguity: bool = True
    teacher_contiguity: bool = False
    teacher_single_room_session: bool = True
    separate_subject_blocks_by_day: bool = True
    prevent_class_overlap: bool = True
    prevent_teacher_overlap: bool = True
    prevent_room_overlap: bool = True
    teacher_daily_max_hours: Optional[int] = 10
    enforce_weekly_limits: bool = True
    optimize_teacher_session_fill: bool = False
    optimize_class_session_fill: bool = False


DEFAULT_DAY_ORDER = [f"Day{i + 1}" for i in range(6)]
DEFAULT_SESSIONS = ["Morning", "Afternoon"]
MAX_SESSION_HOURS = 6


@dataclass
class SolverData:
    lessons: List[Lesson]
    timeslots: List[Timeslot]
    rooms: List[str]
    feasible_pairs: Dict[Lesson, List[Tuple[Timeslot, str]]]
    lessons_by_class: Dict[Tuple[str, str], List[Lesson]]
    lessons_by_teacher: Dict[str, List[Lesson]]
    lesson_teachers: Dict[Tuple[str, str, str], str]
    teacher_limits: Dict[str, Dict[str, int]]
    teachers: List[TeacherRecord]
    day_order: List[str]
    sessions: List[str]
    session_hours: Dict[Tuple[str, str], List[int]]
    session_breaks: Dict[str, List[int]]
    active_hour_groups: Dict[str, Dict[Tuple[str, str], List[int]]] = field(default_factory=dict)
    active_hour_group_names: Dict[str, str] = field(default_factory=dict)
    class_group_map: Dict[Tuple[str, str], str] = field(default_factory=dict)
    teacher_group_map: Dict[str, str] = field(default_factory=dict)


def _notify_progress(callback: Optional[ProgressCallback], stage: str, percent: float, message: Optional[str] = None, extra: Optional[Dict[str, Any]] = None) -> None:
    if not callback:
        return
    try:
        callback(stage, max(0.0, min(1.0, percent)), message, extra)
    except Exception:
        # Progress updates should never interrupt solving; swallow errors silently.
        pass


def generate_schedule(payload: Dict[str, Any], progress_callback: Optional[ProgressCallback] = None) -> Dict[str, Any]:
    """Entry point invoked by the API."""
    _notify_progress(progress_callback, "start", 0.02, "Preparing request")
    config = parse_constraint_config(payload.get("constraints", {}))
    _notify_progress(progress_callback, "constraints_ready", 0.08, "Constraint configuration parsed")
    inputs = prepare_inputs(payload)

    if isinstance(inputs, dict) and inputs.get("status") == "error":
        _notify_progress(progress_callback, "error", 1.0, inputs.get("message"))
        return inputs

    solver_data: SolverData = inputs  # type: ignore[assignment]
    _notify_progress(progress_callback, "normalized", 0.25, "Dataset normalized")
    status, assignments = solve_model(solver_data, config, progress_callback=progress_callback)

    result = build_response(status, assignments, solver_data)
    if result.get("status") == "ok":
        _notify_progress(progress_callback, "complete", 1.0, "Timetable generated")
    else:
        _notify_progress(progress_callback, "error", 1.0, result.get("message"))
    return result


# ---------------------------------------------------------------------------
# Input parsing helpers
# ---------------------------------------------------------------------------


def parse_constraint_config(raw: Dict[str, Any]) -> ConstraintConfig:
    data = raw or {}
    return ConstraintConfig(
        class_contiguity=_bool(data.get("classContiguity"), True),
        teacher_contiguity=_bool(data.get("teacherContiguity"), False),
        teacher_single_room_session=_bool(data.get("teacherSingleRoom"), True),
        separate_subject_blocks_by_day=_bool(data.get("separateSubjectDays"), True),
        prevent_class_overlap=_bool(data.get("preventClassOverlap"), True),
        prevent_teacher_overlap=_bool(data.get("preventTeacherOverlap"), True),
        prevent_room_overlap=_bool(data.get("preventRoomOverlap"), True),
        teacher_daily_max_hours=_parse_daily_limit(data.get("teacherDailyMaxHours", data.get("teacherDailyMax")), 10),
        enforce_weekly_limits=_bool(data.get("enforceWeeklyLimits"), True),
        optimize_teacher_session_fill=_bool(data.get("optimizeTeacherSessionFill", data.get("optimizeSessionFill")), False),
        optimize_class_session_fill=_bool(data.get("optimizeClassSessionFill"), False),
    )


def _bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        if value.lower() in {"true", "1", "yes", "on"}:
            return True
        if value.lower() in {"false", "0", "no", "off"}:
            return False
    return default


def _optional_int(value: Any, default: Optional[int]) -> Optional[int]:
    if value in (None, "", "none"):
        return default
    try:
        parsed = int(value)
        return parsed if parsed >= 0 else default
    except (TypeError, ValueError):
        return default


def _parse_daily_limit(value: Any, default: Optional[int]) -> Optional[int]:
    if isinstance(value, bool):
        return default if value else None
    if isinstance(value, (int, float)):
        parsed = int(value)
        return parsed if parsed >= 0 else None
    if isinstance(value, str):
        stripped = value.strip().lower()
        if stripped in {"", "none", "off", "false", "0"}:
            return None
        if stripped in {"on", "true", "yes"}:
            return default
        try:
            parsed = int(stripped)
            return parsed if parsed >= 0 else None
        except ValueError:
            return default
    return default


def prepare_inputs(payload: Dict[str, Any]) -> SolverData | Dict[str, Any]:
    levels = payload.get("levels", [])
    classes_raw = payload.get("classes", [])
    subjects = payload.get("subjects", [])
    teachers_raw = payload.get("teachers", [])
    breaks = payload.get("breaks", []) or []
    rooms_payload = payload.get("rooms", []) or []
    hours_config = payload.get("hoursConfig", {}) or {}
    active_hour_groups_payload = payload.get("activeHourGroups") or payload.get("availabilityGroups")

    if not levels or not classes_raw or not subjects or not teachers_raw:
        return {"status": "error", "message": "Provide levels, classes, subjects and teachers."}

    day_order = DEFAULT_DAY_ORDER[:]
    (
        sessions,
        session_hours,
        timeslots,
        availability_by_group,
        group_name_lookup,
        default_group_id,
    ) = normalize_active_hour_groups(active_hour_groups_payload, hours_config, day_order)
    if not timeslots:
        return {"status": "error", "message": "No timeslots available with the current hour selection."}

    available_group_ids = set(availability_by_group.keys())

    classes: List[Dict[str, Any]] = []
    class_group_map: Dict[Tuple[str, str], str] = {}
    for cls in classes_raw:
        level = str(cls.get("level") or "").strip()
        name = str(cls.get("name") or "").strip()
        if not level or not name or level not in levels:
            continue
        group_id = cls.get("activeHourGroupId") or cls.get("hoursGroupId") or cls.get("availabilityGroupId")
        if group_id not in available_group_ids:
            group_id = default_group_id
        class_group_map[(level, name)] = group_id
        classes.append({"level": level, "name": name})

    if not classes:
        return {"status": "error", "message": "No valid classes provided."}

    session_breaks = collect_breaks(breaks, sessions, session_hours)

    rooms, allowed_subjects = normalize_rooms(rooms_payload)
    if not rooms:
        return {"status": "error", "message": "No rooms defined."}

    teachers, teacher_group_map = normalize_teachers(teachers_raw, levels, default_group_id, available_group_ids)
    if not teachers:
        return {"status": "error", "message": "No valid teachers provided."}

    lesson_data = build_lessons(levels, classes, subjects, teachers)
    if isinstance(lesson_data, dict) and lesson_data.get("status") == "error":
        return lesson_data

    lessons, lesson_teachers = lesson_data  # type: ignore[assignment]
    availability_sets: Dict[str, Dict[Tuple[str, str], Set[int]]] = {
        group_id: {slot: set(hours) for slot, hours in slots.items()}
        for group_id, slots in availability_by_group.items()
    }
    default_group_slots = availability_sets.get(default_group_id, {})

    class_availability: Dict[Tuple[str, str], Dict[Tuple[str, str], Set[int]]] = {}
    for key, group_id in class_group_map.items():
        class_availability[key] = availability_sets.get(group_id, default_group_slots)

    teacher_availability: Dict[str, Dict[Tuple[str, str], Set[int]]] = {}
    for name, group_id in teacher_group_map.items():
        teacher_availability[name] = availability_sets.get(group_id, default_group_slots)

    feasible_pairs = build_feasible_pairs(
        lessons,
        timeslots,
        rooms,
        allowed_subjects,
        class_availability,
        teacher_availability,
        lesson_teachers,
        group_name_lookup,
        class_group_map,
        teacher_group_map,
    )
    if isinstance(feasible_pairs, dict) and feasible_pairs.get("status") == "error":
        return feasible_pairs

    lessons_by_class = defaultdict(list)
    lessons_by_teacher = defaultdict(list)
    teacher_limits: Dict[str, Dict[str, int]] = {}

    for lesson in lessons:
        lessons_by_class[(lesson.level, lesson.class_name)].append(lesson)
        teacher_name = lesson_teachers.get((lesson.subject, lesson.level, lesson.class_name))
        if teacher_name:
            lessons_by_teacher[teacher_name].append(lesson)

    for teacher in teachers:
        assigned = len(lessons_by_teacher.get(teacher.name, []))
        teacher.assigned_hours = assigned
        effective_min = min(teacher.min_hours, assigned)
        teacher_limits[teacher.name] = {"minHours": effective_min, "maxHours": teacher.max_hours}

    return SolverData(
        lessons=lessons,
        timeslots=timeslots,
        rooms=rooms,
        feasible_pairs=feasible_pairs,  # type: ignore[arg-type]
        lessons_by_class=dict(lessons_by_class),
        lessons_by_teacher=dict(lessons_by_teacher),
        lesson_teachers=lesson_teachers,
        teacher_limits=teacher_limits,
        teachers=teachers,
        day_order=day_order,
        sessions=sessions,
        session_hours=session_hours,
        session_breaks=session_breaks,
        active_hour_groups=availability_by_group,
        active_hour_group_names=group_name_lookup,
        class_group_map=class_group_map,
        teacher_group_map=teacher_group_map,
    )


def normalize_active_hour_groups(
    groups_payload: Iterable[Dict[str, Any]] | None,
    fallback_hours: Dict[str, Any],
    day_order: List[str]
) -> Tuple[List[str], Dict[Tuple[str, str], List[int]], List[Timeslot], Dict[str, Dict[Tuple[str, str], List[int]]], Dict[str, str], str]:
    """Normalize active hour groups and derive global timeslot metadata."""

    raw_groups = list(groups_payload or [])
    if not raw_groups:
        raw_groups = [{
            "id": "default",
            "name": "Default Availability",
            "isDefault": True,
            "hours": fallback_hours or {}
        }]

    normalized_groups = []
    used_ids = set()

    for idx, raw in enumerate(raw_groups, start=1):
        base_id = str(raw.get("id") or raw.get("groupId") or f"group{idx}") or f"group{idx}"
        group_id = base_id
        suffix = 1
        while group_id in used_ids:
            suffix += 1
            group_id = f"{base_id}-{suffix}"
        used_ids.add(group_id)

        name = str(raw.get("name") or raw.get("label") or f"Group {idx}") or f"Group {idx}"
        is_default_raw = raw.get("isDefault")
        if isinstance(is_default_raw, bool):
            is_default = is_default_raw
        elif isinstance(is_default_raw, str):
            is_default = is_default_raw.strip().lower() in {"1", "true", "yes", "on"}
        else:
            is_default = False

        hours_config = raw.get("hours")
        if hours_config is None:
            hours_config = raw.get("hoursConfig")
        hours_dict = hours_config if isinstance(hours_config, dict) else {}

        normalized_map, session_names = _normalize_single_hours_config(hours_dict, day_order)
        normalized_groups.append({
            "id": group_id,
            "name": name,
            "is_default": is_default,
            "hours_by_day": normalized_map,
            "session_names": session_names,
        })

    default_group_id = next((g["id"] for g in normalized_groups if g["is_default"]), normalized_groups[0]["id"])

    union_session_names = set()
    union_hour_map: Dict[Tuple[str, str], set] = defaultdict(set)
    availability_by_group: Dict[str, Dict[Tuple[str, str], List[int]]] = {}
    group_name_lookup: Dict[str, str] = {}

    for group in normalized_groups:
        group_id = group["id"]
        group_name_lookup[group_id] = group["name"]
        union_session_names.update(group["session_names"])
        hours_for_group: Dict[Tuple[str, str], List[int]] = {}
        for day in day_order:
            day_hours = group["hours_by_day"].get(day, {})
            for session, hours in day_hours.items():
                union_hour_map[(day, session)].update(hours)
                hours_for_group[(day, session)] = list(hours)
        availability_by_group[group_id] = hours_for_group

    sessions = sorted(union_session_names, key=lambda s: (0, DEFAULT_SESSIONS.index(s)) if s in DEFAULT_SESSIONS else (1, s))
    if not sessions:
        sessions = DEFAULT_SESSIONS[:]

    session_hours: Dict[Tuple[str, str], List[int]] = {}
    timeslots: List[Timeslot] = []
    for day in day_order:
        for session in sessions:
            hours_list = sorted(union_hour_map.get((day, session), set()))
            session_hours[(day, session)] = hours_list
            for hour in hours_list:
                timeslots.append((day, session, hour))

    # Ensure every group has explicit entries for all session keys, even if empty
    for group_id, hours_map in availability_by_group.items():
        for day in day_order:
            for session in sessions:
                hours_map.setdefault((day, session), [])

    return sessions, session_hours, timeslots, availability_by_group, group_name_lookup, default_group_id


def _normalize_single_hours_config(hours_config: Dict[str, Any], day_order: List[str]) -> Tuple[Dict[str, Dict[str, List[int]]], set]:
    any_configured = bool(hours_config)
    normalized: Dict[str, Dict[str, List[int]]] = {}
    session_names = set()

    for day_index, day in enumerate(day_order):
        raw_day = hours_config.get(day)
        day_config = raw_day if isinstance(raw_day, dict) else {}
        sessions_for_day = [session for session in day_config.keys() if isinstance(session, str)]
        if not sessions_for_day and not any_configured:
            sessions_for_day = DEFAULT_SESSIONS[:]

        normalized[day] = {}
        candidates = sorted(set(sessions_for_day))
        if not candidates:
            candidates = [] if any_configured else DEFAULT_SESSIONS[:]

        for session in candidates:
            configured = day_config.get(session)
            if configured is None:
                hours = default_hours_for_session(day_index, session)
            else:
                hours = sorted({hour for hour in configured if isinstance(hour, int) and 1 <= hour <= MAX_SESSION_HOURS})
            normalized[day][session] = hours
            session_names.add(session)

        if not sessions_for_day and not any_configured:
            # Ensure both default sessions exist when nothing provided
            for session in DEFAULT_SESSIONS:
                if session not in normalized[day]:
                    hours = default_hours_for_session(day_index, session)
                    normalized[day][session] = hours
                    session_names.add(session)

    return normalized, session_names


def default_hours_for_session(day_index: int, session: str) -> List[int]:
    if session == "Afternoon" and day_index == len(DEFAULT_DAY_ORDER) - 1:
        return []
    return [1, 2, 3, 4]


def collect_breaks(breaks: Iterable[Dict[str, Any]], sessions: List[str], session_hours: Dict[Tuple[str, str], List[int]]) -> Dict[str, List[int]]:
    breaks_by_session = defaultdict(set)
    for brk in breaks:
        session = brk.get("session")
        after = brk.get("afterHour")
        if session not in sessions or not isinstance(after, int):
            continue
        for (day, sess), hours in session_hours.items():
            if sess == session and after in hours:
                breaks_by_session[session].add(after)
    return {k: sorted(v) for k, v in breaks_by_session.items()}


def normalize_rooms(rooms_payload: List[Dict[str, Any]]) -> Tuple[List[str], Dict[str, set]]:
    rooms: List[str] = []
    allowed_subjects: Dict[str, set] = {}
    used_names = set()

    if not rooms_payload:
        default_names = [f"Room {i + 1}" for i in range(5)]
        for name in default_names:
            rooms.append(name)
            allowed_subjects[name] = set()
        return rooms, allowed_subjects

    for idx, room in enumerate(rooms_payload, start=1):
        base_name = (room.get("name") or "").strip() or f"Room {idx}"
        unique_name = base_name
        counter = 1
        while unique_name in used_names:
            counter += 1
            unique_name = f"{base_name} ({counter})"
        used_names.add(unique_name)
        subjects = [sub for sub in room.get("subjects", []) if sub]
        rooms.append(unique_name)
        allowed_subjects[unique_name] = set(subjects)
    return rooms, allowed_subjects


def normalize_teachers(
    teachers_raw: List[Dict[str, Any]],
    levels: List[str],
    default_group_id: str,
    available_group_ids: Set[str],
) -> Tuple[List[TeacherRecord], Dict[str, str]]:
    normalized: List[TeacherRecord] = []
    group_map: Dict[str, str] = {}
    for teacher in teachers_raw:
        name = (teacher.get("name") or "").strip()
        subject = (teacher.get("subject") or "").strip()
        if not name or not subject:
            continue
        levels_scope = teacher.get("levels") or levels
        levels_filtered = [lvl for lvl in levels_scope if lvl in levels]
        if not levels_filtered:
            levels_filtered = levels[:]
        min_hours = _safe_int(teacher.get("minHours"), 0)
        max_hours = _safe_int(teacher.get("maxHours"), 24)
        if max_hours is not None and min_hours > max_hours:
            min_hours = max_hours
        group_id = teacher.get("activeHourGroupId") or teacher.get("hoursGroupId") or teacher.get("availabilityGroupId")
        if group_id not in available_group_ids:
            group_id = default_group_id
        normalized.append(
            TeacherRecord(
                name=name,
                subject=subject,
                levels=levels_filtered,
                min_hours=min_hours,
                max_hours=max_hours,
                active_hour_group_id=group_id,
            )
        )
        group_map[name] = group_id
    return normalized, group_map


def _safe_int(value: Any, default: int) -> int:
    try:
        parsed = int(value)
        return parsed if parsed >= 0 else default
    except (TypeError, ValueError):
        return default


def build_lessons(levels: List[str], classes: List[Dict[str, Any]], subjects: List[Dict[str, Any]], teachers: List[TeacherRecord]) -> Tuple[List[Lesson], Dict[Tuple[str, str, str], str]] | Dict[str, Any]:
    subject_teachers = defaultdict(list)
    for teacher in teachers:
        subject_teachers[teacher.subject].append(teacher)

    class_map = defaultdict(list)
    for cls in classes:
        level = cls.get("level")
        name = cls.get("name")
        if level in levels and name:
            class_map[level].append(name)

    lessons: List[Lesson] = []
    lesson_teacher_map: Dict[Tuple[str, str, str], str] = {}

    for subject in subjects:
        subject_name = subject.get("name")
        if not subject_name:
            continue
        available_teachers = subject_teachers.get(subject_name, [])
        block_per_level = subject.get("blocksPerLevel") or []
        if not block_per_level and subject.get("blocks"):
            block_map = subject.get("blocks") or {}
            temp = []
            for level, value in block_map.items():
                options = []
                for opt in str(value).split('|'):
                    nums = [int(token.strip()) for token in opt.split(',') if token.strip()]
                    if nums:
                        options.append(nums)
                if options:
                    temp.append({"level": level, "blocks": options})
            block_per_level = temp
        class_items = []
        for entry in block_per_level:
            level = entry.get("level")
            block_options = entry.get("blocks") or []
            if level not in class_map or not block_options:
                continue
            canonical = block_options[0]
            total_hours = sum(canonical)
            for class_name in class_map[level]:
                eligible = [t for t in available_teachers if level in t.levels]
                class_items.append((len(eligible), -total_hours, level, class_name, block_options, total_hours))

        class_items.sort()

        for _, _, level, class_name, block_options, total_hours in class_items:
            eligible = [t for t in available_teachers if level in t.levels]
            eligible.sort(key=lambda t: t.max_hours - t.assigned_hours, reverse=True)
            chosen = next((t for t in eligible if t.max_hours - t.assigned_hours >= total_hours), None)
            if chosen is None:
                return {
                    "status": "error",
                    "message": f"Insufficient capacity for subject {subject_name}: need {total_hours} hours for class {class_name} ({level})."
                }
            chosen.assigned_hours += total_hours
            lesson_teacher_map[(subject_name, level, class_name)] = chosen.name
            canonical = block_options[0]
            for block_index, block_size in enumerate(canonical):
                for offset in range(block_size):
                    lessons.append(Lesson(subject_name, level, class_name, block_index, offset, block_size))

    return lessons, lesson_teacher_map


def build_feasible_pairs(
    lessons: List[Lesson],
    timeslots: List[Timeslot],
    rooms: List[str],
    allowed_subjects: Dict[str, set],
    class_availability: Dict[Tuple[str, str], Dict[Tuple[str, str], Set[int]]],
    teacher_availability: Dict[str, Dict[Tuple[str, str], Set[int]]],
    lesson_teachers: Dict[Tuple[str, str, str], str],
    group_name_lookup: Dict[str, str],
    class_group_map: Dict[Tuple[str, str], str],
    teacher_group_map: Dict[str, str],
) -> Dict[Lesson, List[Tuple[Timeslot, str]]] | Dict[str, Any]:
    pairs: Dict[Lesson, List[Tuple[Timeslot, str]]] = {}
    for lesson in lessons:
        compatible_rooms = [room for room in rooms if not allowed_subjects[room] or lesson.subject in allowed_subjects[room]]
        if not compatible_rooms:
            return {"status": "error", "message": f"No room available for subject {lesson.subject}."}

        class_key = (lesson.level, lesson.class_name)
        class_allowed = class_availability.get(class_key, {})
        teacher_name = lesson_teachers.get((lesson.subject, lesson.level, lesson.class_name))
        teacher_allowed = teacher_availability.get(teacher_name or "", {})

        lesson_pairs: List[Tuple[Timeslot, str]] = []
        for timeslot in timeslots:
            day, session, hour = timeslot
            if class_allowed:
                slots = class_allowed.get((day, session))
                if slots is not None and hour not in slots:
                    continue
            if teacher_allowed:
                slots = teacher_allowed.get((day, session))
                if slots is not None and hour not in slots:
                    continue
            for room in compatible_rooms:
                lesson_pairs.append((timeslot, room))

        if not lesson_pairs:
            class_group = group_name_lookup.get(class_group_map.get(class_key, ""), "configured availability")
            teacher_group = group_name_lookup.get(teacher_group_map.get(teacher_name or "", ""), "configured availability")
            target = f"class {lesson.level} - {lesson.class_name} ({class_group})"
            if teacher_name:
                target += f" and teacher {teacher_name} ({teacher_group})"
            return {
                "status": "error",
                "message": (
                    f"No feasible timeslots for {target} with subject {lesson.subject}."
                ),
            }

        pairs[lesson] = lesson_pairs
    return pairs


# ---------------------------------------------------------------------------
# Model construction helpers
# ---------------------------------------------------------------------------


def solve_model(
    data: SolverData,
    config: ConstraintConfig,
    progress_callback: Optional[ProgressCallback] = None,
) -> Tuple[int, List[Tuple[Lesson, Timeslot, str]]]:
    _notify_progress(progress_callback, "model_build", 0.35, "Constructing solver variables")
    model = cp_model.CpModel()
    variables = {}
    for lesson, options in data.feasible_pairs.items():
        for timeslot, room in options:
            variables[(lesson, timeslot, room)] = model.NewBoolVar(
                f"x_{lesson.subject}_{lesson.level}_{lesson.class_name}_{lesson.block_index}_{timeslot}_{room}"
            )

    _notify_progress(progress_callback, "constraints", 0.45, "Applying hard constraints")
    apply_assignment_constraint(model, variables, data)
    apply_block_contiguity(model, variables, data, config)

    if config.class_contiguity:
        apply_entity_contiguity(model, variables, data, target='class')
    if config.teacher_contiguity:
        apply_entity_contiguity(model, variables, data, target='teacher')
    if config.teacher_single_room_session:
        apply_teacher_room_constraint(model, variables, data)

    if config.separate_subject_blocks_by_day:
        apply_block_day_separation(model, variables, data)
    if config.prevent_class_overlap:
        apply_no_overlap(model, variables, data, target='class')
    if config.prevent_teacher_overlap:
        apply_no_overlap(model, variables, data, target='teacher')
    if config.prevent_room_overlap:
        apply_room_capacity(model, variables, data)

    if config.teacher_daily_max_hours:
        apply_teacher_daily_limit(model, variables, data, config.teacher_daily_max_hours)
    if config.enforce_weekly_limits:
        apply_teacher_weekly_limits(model, variables, data)

    _notify_progress(progress_callback, "objective", 0.62, "Configuring optimization objective")
    session_slack_terms: List[cp_model.IntVar] = []
    if config.optimize_teacher_session_fill:
        apply_session_fill_objective(model, variables, data, session_slack_terms, entity_type='teacher')
    if config.optimize_class_session_fill:
        apply_session_fill_objective(model, variables, data, session_slack_terms, entity_type='class')

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 600
    solver.parameters.num_search_workers = 8
    solver.parameters.linearization_level = 2
    solver.parameters.log_search_progress = False

    if session_slack_terms:
        model.Minimize(sum(session_slack_terms))
    else:
        model.Minimize(0)

    _notify_progress(progress_callback, "solving", 0.75, "Searching for feasible timetable")
    status = solver.Solve(model)

    assignments: List[Tuple[Lesson, Timeslot, str]] = []
    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for (lesson, timeslot, room), var in variables.items():
            if solver.Value(var):
                assignments.append((lesson, timeslot, room))

    _notify_progress(progress_callback, "solving", 0.95, "Finalizing solution")
    return status, assignments


def apply_assignment_constraint(model: cp_model.CpModel, variables, data: SolverData) -> None:
    for lesson in data.lessons:
        vars_for_lesson = [variables[(lesson, ts, room)] for ts, room in data.feasible_pairs[lesson]]
        model.Add(sum(vars_for_lesson) == 1)


def apply_block_contiguity(model: cp_model.CpModel, variables, data: SolverData, config: ConstraintConfig) -> None:
    block_map = defaultdict(list)
    for lesson in data.lessons:
        block_map[(lesson.subject, lesson.level, lesson.class_name, lesson.block_index, lesson.block_size)].append(lesson)

    for key, lessons in block_map.items():
        subject, level, classname, block_index, block_size = key
        all_times = {timeslot for lesson in lessons for timeslot, _ in data.feasible_pairs[lesson]}
        sorted_slots = sorted(all_times, key=lambda t: (data.day_order.index(t[0]), data.sessions.index(t[1]), t[2]))
        block_choices = []
        for day in {slot[0] for slot in sorted_slots}:
            slots_for_day = [slot for slot in sorted_slots if slot[0] == day]
            slots_for_day.sort(key=lambda t: (data.sessions.index(t[1]), t[2]))
            for start in range(len(slots_for_day) - block_size + 1):
                candidate = slots_for_day[start:start + block_size]
                valid = True
                for current, nxt in zip(candidate, candidate[1:]):
                    if current[1] != nxt[1] or nxt[2] != current[2] + 1:
                        valid = False
                        break
                    if current[2] in data.session_breaks.get(current[1], []):
                        valid = False
                        break
                if not valid:
                    continue
                indicator = model.NewBoolVar(f"block_{subject}_{level}_{classname}_{block_index}_{day}_{start}")
                for lesson, timeslot in zip(lessons, candidate):
                    feasible_rooms = [room for room in data.rooms if (timeslot, room) in data.feasible_pairs[lesson]]
                    if feasible_rooms:
                        model.Add(sum(variables[(lesson, timeslot, room)] for room in feasible_rooms) == 1).OnlyEnforceIf(indicator)
                        model.Add(sum(variables[(lesson, timeslot, room)] for room in feasible_rooms) == 0).OnlyEnforceIf(indicator.Not())
                    else:
                        model.Add(indicator == 0)
                block_choices.append(indicator)
        if not block_choices:
            raise ValueError(f"No valid placement for block {subject}-{level}-{classname} (size {block_size}).")
        model.Add(sum(block_choices) == 1)


def apply_entity_contiguity(model: cp_model.CpModel, variables, data: SolverData, target: str) -> None:
    entity_lookup = data.lessons_by_class if target == 'class' else data.lessons_by_teacher
    for entity, lessons in entity_lookup.items():
        if not lessons:
            continue
        for day in data.day_order:
            for session in data.sessions:
                hours = data.session_hours.get((day, session), [])
                if not hours:
                    continue
                presence_flags = []
                for hour in hours:
                    timeslot = (day, session, hour)
                    relevant = [
                        variables[(lesson, ts, room)]
                        for lesson in lessons
                        for (ts, room) in data.feasible_pairs[lesson]
                        if ts == timeslot
                    ]
                    flag = model.NewBoolVar(f"contig_{target}_{entity}_{day}_{session}_h{hour}")
                    if relevant:
                        model.Add(sum(relevant) >= 1).OnlyEnforceIf(flag)
                        model.Add(sum(relevant) == 0).OnlyEnforceIf(flag.Not())
                    else:
                        model.Add(flag == 0)
                    presence_flags.append(flag)
                if not presence_flags:
                    continue
                allowed_patterns = [[0] * len(presence_flags)]
                for start in range(len(presence_flags)):
                    for span in range(1, len(presence_flags) - start + 1):
                        pattern = [0] * len(presence_flags)
                        for idx in range(start, start + span):
                            pattern[idx] = 1
                        allowed_patterns.append(pattern)
                model.AddAllowedAssignments(presence_flags, allowed_patterns)


def apply_teacher_room_constraint(model: cp_model.CpModel, variables, data: SolverData) -> None:
    for teacher, lessons in data.lessons_by_teacher.items():
        for day in data.day_order:
            for session in data.sessions:
                hrs = data.session_hours.get((day, session), [])
                if not hrs:
                    continue
                room_flags = {}
                for lesson in lessons:
                    for (timeslot, room) in data.feasible_pairs[lesson]:
                        if timeslot[0] == day and timeslot[1] == session:
                            room_flags.setdefault(room, model.NewBoolVar(f"teacher_room_{teacher}_{day}_{session}_{room}"))
                            model.Add(variables[(lesson, timeslot, room)] <= room_flags[room])
                if not room_flags:
                    continue
                for room, flag in room_flags.items():
                    relevant = [variables[(lesson, (day, session, hour), room)] for lesson in lessons for hour in hrs if ((day, session, hour), room) in data.feasible_pairs[lesson]]
                    if relevant:
                        model.Add(sum(relevant) <= len(relevant) * flag)
                    else:
                        model.Add(flag == 0)
                model.Add(sum(room_flags.values()) <= 1)


def apply_block_day_separation(model: cp_model.CpModel, variables, data: SolverData) -> None:
    block_map = defaultdict(list)
    for lesson in data.lessons:
        block_map[(lesson.level, lesson.class_name, lesson.subject)].append(lesson)

    for (level, class_name, subject), lessons in block_map.items():
        block_indices = defaultdict(list)
        for lesson in lessons:
            block_indices[lesson.block_index].append(lesson)
        indices = sorted(block_indices.keys())
        for i in range(len(indices)):
            for j in range(i + 1, len(indices)):
                lessons_a = block_indices[indices[i]]
                lessons_b = block_indices[indices[j]]
                for day in data.day_order:
                    vars_a = [variables[(lesson, timeslot, room)] for lesson in lessons_a for (timeslot, room) in data.feasible_pairs[lesson] if timeslot[0] == day]
                    vars_b = [variables[(lesson, timeslot, room)] for lesson in lessons_b for (timeslot, room) in data.feasible_pairs[lesson] if timeslot[0] == day]
                    if vars_a and vars_b:
                        model.Add(sum(vars_a) + sum(vars_b) <= len(lessons_a) + len(lessons_b) - 1)


def apply_no_overlap(model: cp_model.CpModel, variables, data: SolverData, target: str) -> None:
    lookup = data.lessons_by_class if target == 'class' else data.lessons_by_teacher
    for entity, lessons in lookup.items():
        for timeslot in data.timeslots:
            overlapping = [variables[(lesson, timeslot, room)] for lesson in lessons for (ts, room) in data.feasible_pairs[lesson] if ts == timeslot]
            if overlapping:
                model.Add(sum(overlapping) <= 1)


def apply_room_capacity(model: cp_model.CpModel, variables, data: SolverData) -> None:
    for room in data.rooms:
        for timeslot in data.timeslots:
            overlapping = [variables[(lesson, timeslot, room)] for lesson in data.lessons if (timeslot, room) in data.feasible_pairs[lesson]]
            if overlapping:
                model.Add(sum(overlapping) <= 1)


def apply_teacher_daily_limit(model: cp_model.CpModel, variables, data: SolverData, limit: int) -> None:
    for teacher, lessons in data.lessons_by_teacher.items():
        for day in data.day_order:
            vars_same_day = [variables[(lesson, timeslot, room)] for lesson in lessons for (timeslot, room) in data.feasible_pairs[lesson] if timeslot[0] == day]
            if vars_same_day:
                model.Add(sum(vars_same_day) <= limit)


def apply_teacher_weekly_limits(model: cp_model.CpModel, variables, data: SolverData) -> None:
    for teacher, lessons in data.lessons_by_teacher.items():
        vars_all = [variables[(lesson, timeslot, room)] for lesson in lessons for (timeslot, room) in data.feasible_pairs[lesson]]
        if not vars_all:
            continue
        total_hours = sum(vars_all)
        limits = data.teacher_limits.get(teacher, {})
        max_hours = limits.get("maxHours", 24)
        min_hours = limits.get("minHours", 0)
        if max_hours is not None:
            model.Add(total_hours <= max_hours)
        if min_hours:
            model.Add(total_hours >= min_hours)


def apply_session_fill_objective(
    model: cp_model.CpModel,
    variables,
    data: SolverData,
    slack_terms: List[cp_model.IntVar],
    entity_type: str
) -> None:
    if entity_type == 'teacher':
        lookup = data.lessons_by_teacher
    elif entity_type == 'class':
        lookup = data.lessons_by_class
    else:
        raise ValueError(f"Unknown entity type for session fill: {entity_type}")

    for entity, lessons in lookup.items():
        if not lessons:
            continue
        for day in data.day_order:
            for session in data.sessions:
                hours = data.session_hours.get((day, session), [])
                if not hours:
                    continue
                vars_in_session = [
                    variables[(lesson, timeslot, room)]
                    for lesson in lessons
                    for (timeslot, room) in data.feasible_pairs[lesson]
                    if timeslot[0] == day and timeslot[1] == session
                ]
                if not vars_in_session:
                    continue
                session_flag = model.NewBoolVar(f"{entity_type}_session_used_{entity}_{day}_{session}")
                model.Add(sum(vars_in_session) >= 1).OnlyEnforceIf(session_flag)
                model.Add(sum(vars_in_session) == 0).OnlyEnforceIf(session_flag.Not())
                model.Add(sum(vars_in_session) <= len(vars_in_session) * session_flag)
                slack = model.NewIntVar(0, len(hours), f"{entity_type}_session_slack_{entity}_{day}_{session}")
                model.Add(slack == 0).OnlyEnforceIf(session_flag.Not())
                model.Add(slack + sum(vars_in_session) == len(hours)).OnlyEnforceIf(session_flag)
                slack_terms.append(slack)


# ---------------------------------------------------------------------------
# Output formatting
# ---------------------------------------------------------------------------


def build_response(status: int, assignments: List[Tuple[Lesson, Timeslot, str]], data: SolverData) -> Dict[str, Any]:
    solver_status = {
        cp_model.UNKNOWN: "UNKNOWN",
        cp_model.MODEL_INVALID: "MODEL_INVALID",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.OPTIMAL: "OPTIMAL",
    }.get(status, "UNKNOWN")

    formatted = []
    for lesson, timeslot, room in assignments:
        teacher = data.lesson_teachers.get((lesson.subject, lesson.level, lesson.class_name))
        formatted.append({
            "subject": lesson.subject,
            "level": lesson.level,
            "class": lesson.class_name,
            "block_idx": lesson.block_index,
            "block_size": lesson.block_size,
            "hour_in_block": lesson.offset + 1,
            "timeslot": timeslot,
            "room": room,
            "teacher": teacher,
        })

    demand_by_subject = defaultdict(int)
    for lesson in data.lessons:
        demand_by_subject[lesson.subject] += 1

    capacity_by_subject = defaultdict(int)
    for teacher in data.teachers:
        capacity_by_subject[teacher.subject] += teacher.max_hours

    subject_rows = []
    for subject in sorted(set(demand_by_subject) | set(capacity_by_subject)):
        subject_rows.append({
            "subject": subject,
            "required": demand_by_subject.get(subject, 0),
            "available": capacity_by_subject.get(subject, 0),
            "delta": capacity_by_subject.get(subject, 0) - demand_by_subject.get(subject, 0)
        })

    teacher_rows = []
    for teacher in data.teachers:
        teacher_rows.append({
            "name": teacher.name,
            "subject": teacher.subject,
            "minHours": teacher.min_hours,
            "maxHours": teacher.max_hours,
            "assignedHours": teacher.assigned_hours,
            "effectiveMinHours": min(teacher.min_hours, teacher.assigned_hours),
            "levels": teacher.levels,
        })

    status_key = "ok" if status in (cp_model.FEASIBLE, cp_model.OPTIMAL) else "error"
    message = None
    if status_key == "error":
        message = "Solver was unable to find a feasible timetable within the time limit." if status == cp_model.UNKNOWN else "Solver reported infeasibility."

    response = {
        "status": status_key,
        "solverStatus": solver_status,
        "solution": formatted,
        "capacityReport": {"rows": subject_rows},
        "teacherHours": teacher_rows,
    }
    if message:
        response["message"] = message
    return response
