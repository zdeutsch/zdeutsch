const { readJsonByKey, writeJsonByKey, listDatabaseFiles } = require("../repositories/jsonRepository");
const { isPlainObject } = require("../utils/validators");
const AppError = require("../utils/appError");

async function listFiles() {
  return listDatabaseFiles();
}

async function getFile(fileKey) {
  const data = await readJsonByKey(fileKey);
  return {
    fileKey,
    data
  };
}

async function replaceFile(fileKey, data) {
  if (!isPlainObject(data) && !Array.isArray(data)) {
    throw new AppError("Replacement data must be an object or array", 400);
  }
  await writeJsonByKey(fileKey, data);
  return getFile(fileKey);
}

module.exports = {
  listFiles,
  getFile,
  replaceFile
};
