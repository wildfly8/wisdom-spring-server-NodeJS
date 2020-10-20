require('dotenv').config()

var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const mongoose = require('mongoose');
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var apiRouter = require('./routes/api');
var cors = require('cors');

var app = express();
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
//app.use('/', indexRouter);
//app.use('/users', usersRouter);
app.use('/api', apiRouter);

if(process.env.NODE_ENV === 'production') { 
  app.use(express.static('client/build'));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
}

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};  //app.get('env') == NODE_ENV value in Express
  // render the error page
  res.status(err.status || 500);
  res.send('error');
});

//setup mongoDB datasource
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
})
.then(() =>  console.log('MongoDB covid19 connection successful.'))
.catch((err) => console.error(err))

const db = mongoose.connection
db.on('error', (error) => console.error(error))
db.once('open', () => console.log('Opened DB connection'));
db.once('close', () => console.log('Closed DB connection'));


module.exports = app;