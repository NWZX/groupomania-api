let bcrypt = require("bcrypt");
let jsonwebtoken = require("jsonwebtoken");
const { isAuth } = require("./auth");
const db = require("./dataManager");
//Password : 123456789



exports.GetUser = async ({ username, userId }, context, info) => {
    if (!isAuth(context))
        return new Error("Authentification error");
    if (!username && !userId)
        username = context.token.userId;

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result;
        if (userId) {
            result = await dbConnect.query("SELECT * FROM users WHERE id = ?", [
                userId
            ]);
        }
        else {
            result = await dbConnect.query("SELECT * FROM users WHERE username = ?", [
                username
            ]);
        }
        if (!result.length) {
            throw new Error("Username invalid");
        }

        return {
            id: result[0].id,
            username: result[0].username,
            authorization: result[0].authorization
        };
    } catch (error) {
        if (error.fatal)
            dbConnect.destroy();
        throw error;
    }
    finally {
        if (dbConnect) {
            dbConnect.release();
        }
    }
}

exports.CreateUser = async ({ username, password }, context, info) => {
    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("INSERT INTO users (username, password, `timestamp`, `authorization`) VALUES(?, ?, unix_timestamp(), 0)", [
            username,
            bcrypt.hashSync(password, 4)
        ]);
        if (result.affectedRows != 1) {
            throw new Error("Error : user creation");
        }

        return {
            username: username,
            token: jsonwebtoken.sign(
                { userId: username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            ),
        }
    } catch (error) {
        if (error.fatal)
            dbConnect.destroy();
        throw error;
    }
    finally {
        if (dbConnect) {
            dbConnect.release();
        }
    }
}
exports.LoginUser = async ({ username, password }, context, info) => {
    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE username = ?", [
            username
        ]);
        if (!result.length) {
            throw new Error("Username invalid");
        }

        if (bcrypt.compareSync(password, result[0].password)) {
            return {
                username: username,
                token: jsonwebtoken.sign(
                    { userId: username },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                ),
            }
        }
        else {
            throw new Error("Password invalid");
        }
    } catch (error) {
        if (error.fatal)
            dbConnect.destroy();
       throw error;
    }
    finally {
        if (dbConnect) {
            dbConnect.release();
        }
    }   
}

exports.DelUser = async ({ username }, context, info) => {
    if (!isAuth(context) || username != context.token.userId)
        return new Error("Authentification error");
    
    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE username = ?", [
            username
        ]);
        if (!result.length) {
            throw new Error("Username invalid");
        }

        await dbConnect.query("DELETE FROM users WHERE username = ?", [
            username
        ]);

        //Implement delete file relative to user

        return true;
    } catch (error) {
        if (error.fatal)
            dbConnect.destroy();
        throw error;
    }
    finally {
        if (dbConnect) {
            dbConnect.release();
        }
    }
}