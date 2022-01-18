DEST=../mock-repl-deploy

rm -rf $DEST/*
mkdir -p $DEST/src $DEST/dist

cp src/*.js $DEST/src
cp dist/*.js $DEST/src
cp index.html $DEST
