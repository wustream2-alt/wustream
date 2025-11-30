const Datastore = require("nedb-promises");

const blockedIps = Datastore.create({
  filename: "./db/blockedIpAddresses.db",
  autoload: true
});

module.exports = blockedIps;
