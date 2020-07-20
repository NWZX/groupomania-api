const { isAuth } = require("./auth");
const db = require("./dataManager");

exports.AddComment = async ({ username, postId, data }, context, info) => {
    if (!isAuth(context) || username != context.token.userId)
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE users.username = ?", [
            username
        ]);

        let insert = await dbConnect.query("INSERT INTO comments (postId, userId, data, `timestamp`) VALUES(?, ?, ?, unix_timestamp())", [
            postId,
            result[0].id,
            data,
        ]);
        if (insert.affectedRows != 1) {
            throw new Error("Error : post creation");
        }

        return {
            id: insert.insertId,
            userId: result[0].id,
            postId: postId,
            data: data,
            timestamp: Date.now() / 1000
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

exports.EditComment = async ({ id, username, data }, context, info) => {
    if (!isAuth(context) || username != context.token.userId)
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE users.username = ?", [
            username
        ]);

        let update = await dbConnect.query("UPDATE comments SET `data`=?, timestamp=unix_timestamp() WHERE id = ?  AND userId = ?", [
                data,
                id,
                result[0].id
            ]);

        if (update.affectedRows != 1) {
            throw new Error("Error : post edit");
        }

        return {
            id: id,
            userId: result[0].id,
            postId: postId,
            data: data,
            timestamp: Date.now() / 1000
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

exports.DelComment = async ({ username, id }, context, info) => {
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

        if (result) {
            await dbConnect.query("DELETE FROM comments WHERE id = ?", [
                id
            ]);
            return true;
        }
        return false;

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