var path = require('path');

exports.req = function(relativePath) {
  return require(path.join(process.cwd(), relativePath))
}