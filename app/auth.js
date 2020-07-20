exports.isAuth = (context) => {
    if (context && context.token) {
        return true;
    }
    else {
        return false;
    }
}