const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const { graphqlUploadExpress } = require('graphql-upload')
const cors = require('cors');

const { loadSchemaSync } = require("@graphql-tools/load");
const { GraphQLFileLoader } = require("@graphql-tools/graphql-file-loader");

const multer = require('multer');
const fs = require('fs');
const { join } = require("path");
const sharp = require("sharp");
const webp = require('webp-converter');
const crypto = require("crypto");

const PostResolver = require("./PostResolver");
const UserResolver = require("./UserResolver");

const jwt = require('express-jwt');
const { AddComment, EditComment, DelComment } = require('./CommentResolver');
require('dotenv').config()

// Construct a schema, using GraphQL schema language
const schema = loadSchemaSync(join(__dirname, 'schema.graphql'), { loaders: [new GraphQLFileLoader()] });

// The root provides a resolver function for each API endpoint
let root = {
    posts: PostResolver.GetAllPost,
    post: PostResolver.GetPost,
    addPost: PostResolver.AddPost,
    editPost: PostResolver.EditPost,
    delPost: PostResolver.DelPost,

    addComment: AddComment,
    editComment: EditComment,
    delComment: DelComment,

    vote: PostResolver.GetVote,
    newVote: PostResolver.NewVote,
    
    user: UserResolver.GetUser,
    createUser: UserResolver.CreateUser,
    loginUser: UserResolver.LoginUser,
    delUser: UserResolver.DelUser,
};

const auth = jwt({
    secret: process.env.JWT_SECRET,
    credentialsRequired: false,
    algorithms : ['HS256'],
})
const path = join(__dirname, '..', 'upload');
const randomKey = (segement)=>{
    let array = new Uint32Array(segement);
    return crypto.randomBytes(segement * 8).toString('hex');
}
const storage = multer.diskStorage({
    destination: (req, file, callback) => {
        callback(null, path);
    },
    filename: (req, file, callback) => {
        let name = randomKey(2) + new Date().getTime() + randomKey(2);
        const ext = file.mimetype.split('/')[1];
        while (fs.existsSync(join(path, name + '.' + ext))) {
            name += randomKey(1);
        }
        callback(null, name + '.' + ext);
    }
});
/**
 * 
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
const converter = async(req, res, next) => {
    try {
        if (req.file) {
            let { filename } = req.file;

            if (req.file.filename.split('.')[1] == "webp") {
                await sharp(req.file.path, { pages: -1 })
                    .resize(500)
                    .toFile(
                        join(req.file.destination, filename)
                    );
            }
            else if (req.file.filename.split('.')[1] == "gif") {
                filename = filename.split('.')[0] + '.webp';
                const result = await webp.gwebp(req.file.path, join(req.file.destination, filename), "-q 80 -lossy");
                if (typeof result != 'string' || result.split(" ")[0] != "Saved") {
                    throw new Error("Convert Error");
                }
                req.file.filename = filename;
                req.file.mimetype = "image/webp";
            }
            else {
                filename = filename.split('.')[0] + '.webp';
                const result = await webp.cwebp(req.file.path, join(req.file.destination, filename), "-q 90 -resize 500 0");
                if (typeof result != 'string' || result.split(" ")[0] != "Saving") {
                    throw new Error("Convert Error");
                }
                req.file.filename = filename;
                req.file.mimetype = "image/webp";
            }
            fs.unlinkSync(req.file.path);
            res.status(200).json({
                result: true,
                fileUrl: "http://localhost:4000/blob/" + filename,
            });
        }
        else {
            throw new Error("No file");
        }
    }
    catch (error) {
        if (fs.existsSync(req.file.path))
            fs.unlinkSync(req.file.path);
        res.status(500).json({
            result: false,
        });
    }
}
/**
 * 
 * @param {e.Request<ParamsDictionary, any, any, qs.ParsedQs>} req
 * @param {Express.Multer.File} file
 * @param {multer.FileFilterCallback} callback
 */
const fileFilter = (req, file, callback) => {
    if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype)) {
        callback(null, true);
    }
    else {
        callback(null, false);
    }
}

var app = express();

app.use(cors());
app.use(express.json());
app.use('/blob', express.static(path));
app.post(
    "/upload",
    auth,
    multer(
        {
            storage: storage,
            limits: {
                fieldSize: 2097152
            },
            fileFilter: fileFilter
        }).single('image'),
    converter
);

app.use('/graphql', auth, graphqlHTTP( req => ({
    schema: schema,
    rootValue: root,
    context: {
        token: req.user,
    },
    graphiql: true,
})));


app.listen(4000);
console.log('Running a GraphQL API server at http://localhost:4000/graphql');