const fs = require("fs");
const path = require("path");

exports.getJson = function getJson(filepath) {
  filepath = path.join(__dirname, filepath);
  const json = fs.existsSync(filepath) ? require(filepath) : {};
  return json;
};

exports.saveJson = function saveJson(filepath, obj) {
  filepath = path.join(__dirname, filepath);
  const json = JSON.stringify(obj, null, "  ");
  fs.writeFileSync(filepath, json, (err) => {
    if (err) throw err;
  });
};
