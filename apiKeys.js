const Datastore = require("nedb-promises");

const apiKeys = Datastore.create({
  filename: "./db/apiKeys.db",
  autoload: true
});

module.exports = apiKeys;
