var express = require('express')
const router = express.Router();
require('dotenv').config();

const path = require("path");
const fs = require('fs');
// get the client
const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    database: process.env.DATABASE,
    password: process.env.PASSWORD,
    port: process.env.PORT_DB,
    ssl: {ca: fs.readFileSync(path.join(__dirname, process.env.SSL))}
  });

connection.connect((err) => {
if((err)) {
    console.log('Error connecting to MySQL database =', err)
    return;
}
console.log('MySQL successfully connected!');
})

router.get('/get-distinct-years', (req, res) => {
    const sql = `
        SELECT DISTINCT Year
        FROM classroom
        ORDER BY Year;
    `;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error querying distinct years:', err);
            return res.status(500).json({ error: 'Failed to retrieve distinct years' });
        }
        // res.status(200).json(results);
        const years = results.map(result => result.Year);
        return res.status(200).json(years);
    });
});

router.get('/personnel-get-student-info', (req, res) => {
    const { Student_ID } = req.query;

    // SQL query to get NameTitle, FirstName, and LastName by Student_ID
    const sql = `
        SELECT Student_ID, NameTitle, FirstName, LastName
        FROM Student
        WHERE Student_ID = ?
    `;

    // Execute the SQL query
    connection.query(sql, [Student_ID], (err, results) => {
        if (err) {
            console.error('Error querying student information:', err);
            return res.status(500).json({ error: 'Failed to retrieve student information' });
        }
        
        // Check if the student information is found
        if (results.length === 0) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Return the student information
        res.status(200).json(results[0]);
    });
});



module.exports = router;