const Datastore = require("nedb-promises");

const oneTimeDB = Datastore.create({
  filename: "./db/oneTimeTokens.db",
  autoload: true
});

module.exports = oneTimeDB;
