const mariadb = require('mariadb');
require('dotenv').config()
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    idleTimeout: 86400,
});
/**
 * @type Promise<import('mariadb').PoolConnection>
 */
exports.getConnection = pool.getConnection();