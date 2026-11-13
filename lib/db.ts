import mysql from "mysql2/promise";

// 개발 서버의 핫 리로드마다 풀이 새로 생기지 않게 전역에 하나만 둔다.
const g = globalThis as unknown as { pool?: mysql.Pool };
export const db = (g.pool ??= mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5, dateStrings: true }));
