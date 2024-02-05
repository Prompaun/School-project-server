const Parent_api = require('./Parent-api');
const Personnel_api = require('./Pesonnel-api');
const Student_api = require('./Student-api');

var express = require('express')
var cors = require('cors')
require('dotenv').config();

// ต่อ database หรือทำสิ่งอื่น ๆ ที่ต้องการกับค่า config
var app = express();
app.use(express.json());

app.use(cors())

//use routes
app.use(Parent_api);
// app.use(Personnel_api);
// app.use(Student_api);


//ser port
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
