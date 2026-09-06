(function exposeSprachbausteineUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.ZDeutschSprachbausteine = api;
  }
}(typeof globalThis !== "undefined" ? globalThis : this, function createSprachbausteineUtils() {
  function cleanAnswer(value) {
    return String(value || "").trim();
  }

  function splitPairedAnswer(value) {
    const answer = cleanAnswer(value);
    if (!answer) {
      return [];
    }
    const parts = answer
      .split(/\s*(?:…|\.{3})\s*/)
      .map(cleanAnswer)
      .filter(Boolean);
    return parts.length > 1 ? parts : [answer];
  }

  function canonicalAnswer(value) {
    return splitPairedAnswer(value).join(" … ");
  }

  function sameAnswer(left, right) {
    const leftValue = canonicalAnswer(left);
    const rightValue = canonicalAnswer(right);
    return Boolean(leftValue && rightValue && leftValue === rightValue);
  }

  function countBlankOccurrences(tokens = []) {
    const counts = new Map();
    (tokens || []).forEach((token) => {
      if (token?.type !== "blank") {
        return;
      }
      const id = cleanAnswer(token.id);
      if (id) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    });
    return counts;
  }

  function resolveCorrectAnswer(storedAnswer, options = [], occurrenceCount = 1) {
    const answer = cleanAnswer(storedAnswer);
    const availableOptions = (options || []).map(cleanAnswer).filter(Boolean);
    const exact = availableOptions.find((option) => sameAnswer(option, answer));
    if (exact) {
      return exact;
    }

    if (occurrenceCount > 1 && answer) {
      const matches = availableOptions.filter((option) => {
        const parts = splitPairedAnswer(option);
        return parts.length === occurrenceCount && parts.some((part) => sameAnswer(part, answer));
      });
      if (matches.length === 1) {
        return matches[0];
      }
    }

    return answer;
  }

  function answerForOccurrence(answer, occurrenceIndex = 0, occurrenceCount = 1) {
    const value = cleanAnswer(answer);
    const parts = splitPairedAnswer(value);
    if (occurrenceCount > 1 && parts.length === occurrenceCount && parts[occurrenceIndex]) {
      return parts[occurrenceIndex];
    }
    return value;
  }

  return {
    cleanAnswer,
    splitPairedAnswer,
    canonicalAnswer,
    sameAnswer,
    countBlankOccurrences,
    resolveCorrectAnswer,
    answerForOccurrence
  };
}));
