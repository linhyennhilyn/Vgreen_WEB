/** 
 * Cấu hình database 
 * Database name: vgreen (cố định) 
 */ 

const DATABASE_NAME = "vgreen";
const MONGODB_HOST = process.env.MONGODB_HOST || "localhost";
const MONGODB_PORT = process.env.MONGODB_PORT || "27017";
const MONGODB_URI = `mongodb://${MONGODB_HOST}:${MONGODB_PORT}/${DATABASE_NAME}`;

module.exports = {
  DATABASE_NAME,
  MONGODB_URI,
  MONGODB_HOST,
  MONGODB_PORT,
};
