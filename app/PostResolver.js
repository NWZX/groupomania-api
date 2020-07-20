const { isAuth } = require("./auth");
const db = require("./dataManager");
const fs = require('fs');
const { join } = require("path");
const storeFS = ({ stream, filename }) => {
    const uploadDir = '../upload';
    const path = `${uploadDir}/${filename}`;
    return new Promise((resolve, reject) =>
        stream
            .on('error', error => {
                if (stream.truncated)
                    // delete the truncated file
                    fs.unlinkSync(path);
                reject(error);
            })
            .pipe(fs.createWriteStream(path))
            .on('error', error => reject(error))
            .on('finish', () => resolve({ path }))
    );
}

exports.GetAllPost = async ({ limit, timestamp }, context, info) => {
    if (!isAuth(context))
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        if (!limit)
            limit = 100;
        if (!timestamp)
            timestamp = 0;

        let result = await dbConnect.query("SELECT * FROM posts WHERE timestamp > ? ORDER BY id DESC LIMIT ?", [
            timestamp,
            limit
        ]);

        for (let i = 0; i < result.length; i++) {
            let user = await dbConnect.query("SELECT * FROM users WHERE users.id = ?", [
                result[i].userId
            ]);
            result[i].userId = undefined;
            result[i].user = { id: user[0].id, username: user[0].username, authorization: user[0].authorization };
            
            result[i].comments = await dbConnect.query("SELECT * FROM comments WHERE postId = ?", [
                result[i].id
            ]); 
            result[i].commentsNumber = result[i].comments.length;
        }

        return result;
        
    } catch (error) {
        if (error.fatal)
        throw error;
    }
    finally {
        if (dbConnect) {
            dbConnect.release();
        }
    }
    
}
exports.GetPost = async ({ id }, context, info) => {
    if (!isAuth(context))
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM posts WHERE id = ?", [
            id
        ]);
        if (!result.length) {
            throw new Error("Post ID invalid");
        }
        let user = await dbConnect.query("SELECT * FROM users WHERE users.id = ?", [
            result[0].userId
        ]);
        result[0].userId = undefined;
        result[0].user = { id: user[0].id, username: user[0].username, authorization: user[0].authorization };
        result[0].comments = await dbConnect.query("SELECT * FROM comments WHERE postId = ?", [
            id
        ]);
        result[0].commentsNumber = result[0].comments.length;

        return result[0];

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

exports.GetVote = async ({ postId }, context, info) => {
    if (!isAuth(context))
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT postId, SUM(spin) FROM votes WHERE postId = ?", [
            postId
        ]);
        if (!result.length) {
            throw new Error("Post ID invalid");
        }

        return result;

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

exports.AddPost = async ({ username, type, categorie, title, data, url }, context, info) => {
    if (!isAuth(context) || username != context.token.userId)
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE users.username = ?", [
            username
        ]);

        if (categorie == "" || title == "" || (data == "" && url == "")) {
            throw new Error("Missing information");
        }

        let insert = await dbConnect.query("INSERT INTO posts (userId, `type`, categorie, title, `data`, url, `timestamp`, editUserId, editTimestamp) VALUES(?, ?, ?, ?, ?, ?, unix_timestamp(), NULL, NULL)", [
            result[0].id,
            type,
            categorie,
            title,
            data,
            url
        ]);
        if (insert.affectedRows != 1) {
            throw new Error("Error : post creation");
        }

        return {
            id: insert.insertId,
            user: { id: result[0].id, username: result[0].username, authorization: result[0].authorization },
            type: type,
            categorie: categorie,
            title: title,
            data: data,
            url: url,
            timestamp: (Date.now() / 1000),
            commentsNumber: 0,
            comments: []
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

exports.EditPost = async ({ id, username, type, categorie, title, data, url }, context, info) => {
    if (!isAuth(context) || username != context.token.userId)
        return new Error("Authentification error");

    let dbConnect;
    try {
        dbConnect = await db.getConnection;

        let result = await dbConnect.query("SELECT * FROM users WHERE users.username = ?", [
            username
        ]);

        if (categorie === [] || title === "" || (data === "" && url === "")) {
            throw new Error("Missing information");
        }

        let old = await this.GetPost({ id }, context, info);

        let update;
        if (result[0].authorization >= 1) {
            update = await dbConnect.query("UPDATE posts SET `type`=?, categorie=?, title=?, `data`=?, url=?, editUserId=?, editTimestamp=unix_timestamp() WHERE id = ?", [
                type,
                categorie,
                title,
                data,
                url,
                result[0].id,
                id
            ]);
        }
        else{
            update = await dbConnect.query("UPDATE posts SET `type`=?, categorie=?, title=?, `data`=?, url=?, editUserId=?, editTimestamp=unix_timestamp() WHERE id = ? AND userId = ?", [
                type,
                categorie,
                title,
                data,
                url,
                result[0].id,
                id,
                result[0].id
            ]);
        }

        if (update.affectedRows != 1) {
            if (old.url != url) {
                const t = url.split('/');
                const path = join(__dirname, '..', 'upload');
                fs.unlinkSync(join(path, t[t.length - 1]));
            }
            throw new Error("Error : post edit");
        }
        if (old && old.url != url) {
            const t = old.url.split('/');
            const path = join(__dirname, '..', 'upload');
            fs.unlinkSync(join(path, t[t.length - 1]));
        }

        return {
            id: id,
            user: null,
            type: type,
            categorie: categorie,
            title: title,
            data: data,
            url: url,
            timestamp: null,
            editUser: { id: result[0].id, username: result[0].username, authorization: result[0].authorization },
            editTimestamp: (Date.now() / 1000),
            commentsNumber: 0,
            comments: []
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

exports.DelPost = async ({ username, id }, context, info) => {
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
            let old = await this.GetPost({ id }, context, info);
            await dbConnect.query("DELETE FROM posts WHERE id = ?", [
                id
            ]);
            if (old && old.url != "") {
                const t = old.url.split('/');
                const path = join(__dirname, '..', 'upload');
                fs.unlinkSync(join(path, t[t.length - 1]));
            }
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

exports.NewVote = async ({ postId, username, spin }, context, info) => {
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
            await dbConnect.query("UPDATE posts SET spin=? WHERE userId = ? AND postId = ?", [
                spin,
                result[0].id,
                postId
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