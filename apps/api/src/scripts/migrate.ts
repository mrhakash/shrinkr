import { openDatabase, migrate, seedPlans } from '../db/index.js';

const path = process.env.SHRINKR_DB_PATH ?? 'data/shrinkr.sqlite';
const db = openDatabase(path);
migrate(db);
seedPlans(db);
console.log(`migrations applied to ${path}`);
db.close();
