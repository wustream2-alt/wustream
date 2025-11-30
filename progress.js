// radioprogress.js
const Datastore = require('nedb-promises');
const progressDB = Datastore.create({ filename: './db/progress.db', autoload: true });
const progressDB2 = Datastore.create({ filename: './db/progress2.db', autoload: true });

module.exports = {
    progressDB,
    progressDB2
};