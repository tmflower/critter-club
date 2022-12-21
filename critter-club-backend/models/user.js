"use strict";

const db = require("../db");
const bcrypt = require("bcrypt");
const { BCRYPT_WORK_FACTOR } = require("../config");

const {
    BadRequestError,
    UnauthorizedError,
  } = require("../expressError");

  class User {

    static async authenticate(username, password) {
        // try to find the user first
        const result = await db.query(
              `SELECT username,
                      password,
                      access_code AS "accessCode",
                      num_cards AS "numCards",
                      level,
                      parent_id AS "parentId"
               FROM users
               WHERE username = $1`,
            [username],
        );
    
        const user = result.rows[0];
    
        if (user) {
          // compare hashed password to a new hash from password
          const isValid = await bcrypt.compare(password, user.password);
          if (isValid === true) {
            delete user.password;
            return user;
          }
        }    
        throw new UnauthorizedError("Invalid username/password");
      }

    static async register(
        { username, password, accessCode, parentId }) 
        {
        const checkUsername = await db.query(
            `SELECT username
            FROM users
            WHERE username = $1`,
            [username],
        );
        if (checkUsername.rows[0]) {
            throw new BadRequestError(`Username ${username} already taken.`);
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_WORK_FACTOR);

        const result = await db.query(
              `INSERT INTO users
               (username,
                password,
                access_code,
                num_cards,
                level,
                parent_id)
               VALUES ($1, $2, $3, $4, $5, $6)
               RETURNING username, access_code AS "accessCode", num_cards AS "numCards", level, parent_id AS "parentId"`,
            [
              username,
              hashedPassword,
              accessCode,
              0,
              "Observer",
              parentId
            ],
        );

        const enteredCode = accessCode;

        const res = await db.query(
            `SELECT access_code,
            id
            FROM parents`
        );
        
        const codes = [];
        for (let row of res.rows) {
            codes.push(row.access_code);
        }

        for (let row of res.rows) {
            if (!codes.includes(+enteredCode)) {
                db.query(
                `DELETE
                FROM users
                WHERE username = $1`,
                [username]
            )
                throw new BadRequestError("Wrong access code");
            }

            if (row.access_code === +enteredCode) {
                let parent = row.id;
                const finalRes = await db.query(
                    `UPDATE users
                    SET parent_id=${parent}
                    WHERE username = $1
                    RETURNING username, access_code AS "accessCode", num_cards AS "numCards", level, parent_id AS "parentId"`,
                    [username]
                )
                const user = finalRes.rows[0];
                return user;
            }
        }
    }

    static async get(username) {
        const userRes = await db.query(
            `SELECT username
             FROM users
             WHERE username = $1`,
          [username],
      );
  
      const user = userRes.rows[0];
  
      if (!user) throw new Error(`No user: ${username}`);
  
      return user;
    }
  }

  module.exports = User;