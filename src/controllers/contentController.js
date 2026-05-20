// Import semua fungsi dari sub-folder 'content'
const bulkImportSamples = require("./content/bulkImport");
const createContent = require("./content/create");
const { getAllContents, getContentById } = require("./content/read");
const updateContent = require("./content/update");
const deleteContent = require("./content/delete");

// Export kembali sebagai satu kesatuan objek controller
module.exports = {
  bulkImportSamples,
  createContent,
  getAllContents,
  getContentById,
  updateContent,
  deleteContent,
};