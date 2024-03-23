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
        res.status(200).json(results);
    });
});

router.get('/get-distinct-years-of-personnel', (req, res) => {
    const { Personnel_Email } = req.query;
    const sql = `
        SELECT DISTINCT Year
        FROM Class_Teacher
        WHERE Personnel_Email = ?
    `;

    connection.query(sql, [Personnel_Email], (err, results) => {
        if (err) {
            console.error('Error querying distinct years of personnel:', err);
            return res.status(500).json({ error: 'Failed to retrieve distinct years of personnel' });
        }
        // res.status(200).json(results);
        const years = results.map(result => result.Year);
        return res.status(200).json(years);
    });
});

router.get('/get-classroom-info-from-personnel', (req, res) => {
    const { Personnel_Email } = req.query;

    // SQL query to get Year, Level, Room by Personnel_Email
    const sql = `
        SELECT Year, Level, Room
        FROM Class_Teacher
        WHERE Personnel_Email = ?
    `;

    // Execute the SQL query to get Year, Level, Room
    connection.query(sql, [Personnel_Email], (err, results) => {
        if (err) {
            console.error('Error querying class_teacher information:', err);
            return res.status(500).json({ error: 'Failed to retrieve class_teacher information' });
        }

        // Check if the class_teacher information is found
        if (results.length === 0) {
            return res.status(404).json({ error: 'Not found class of this class teacher' });
        }

        // Get Year, Level, Room from all results
        const classroomInfo = results.map(result => {
            return {
                Year: result.Year,
                Level: result.Level,
                Room: result.Room
            };
        });

        // SQL query to get Student_ID by Year, Level, Room
        const classroomQuery = `
            SELECT Student_ID
            FROM classroom
            WHERE Year = ? AND Level = ? AND Room = ?
        `;

        // Execute the SQL query to get Student_ID for each classroomInfo
        const promises = classroomInfo.map(info => {
            return new Promise((resolve, reject) => {
                connection.query(classroomQuery, [info.Year, info.Level, info.Room], (err, classroomResults) => {
                    if (err) {
                        console.error('Error querying classroom information:', err);
                        return reject(err);
                    }
                    info.Student_ID = classroomResults.map(result => result.Student_ID);
                    resolve();
                });
            });
        });

        // Wait for all promises to resolve
        Promise.all(promises)
            .then(() => {
                // Return the classroomInfo with Student_ID results
                res.status(200).json(classroomInfo);
            })
            .catch(err => {
                res.status(500).json({ error: 'Failed to retrieve classroom information' });
            });
    });
});


// router.get('/get-classroom-info-from-personnel', (req, res) => {
//     const { Personnel_Email } = req.query;

//     // SQL query to get Year, Level, Room by Personnel_Email
//     const sql = `
//         SELECT Year, Level, Room
//         FROM Class_Teacher
//         WHERE Personnel_Email = ?
//     `;

//     // Execute the SQL query to get Year, Level, Room
//     connection.query(sql, [Personnel_Email], (err, results) => {
//         if (err) {
//             console.error('Error querying class_teacher information:', err);
//             return res.status(500).json({ error: 'Failed to retrieve class_teacher information' });
//         }

//         // Check if the class_teacher information is found
//         if (results.length === 0) {
//             return res.status(404).json({ error: 'Not found class of this class teacher' });
//         }

//         // Get Year, Level, Room from the first result
//         const { Year, Level, Room } = results[0];

//         // SQL query to get Student_ID by Year, Level, Room
//         const classroomQuery = `
//             SELECT Student_ID
//             FROM classroom
//             WHERE Year = ? AND Level = ? AND Room = ?
//         `;

//         // Execute the SQL query to get Student_ID
//         connection.query(classroomQuery, [Year, Level, Room], (err, classroomResults) => {
//             if (err) {
//                 console.error('Error querying classroom information:', err);
//                 return res.status(500).json({ error: 'Failed to retrieve classroom information' });
//             }

//             // Return the Student_ID results
//             res.status(200).json(classroomResults);
//         });
//     });
// });

router.get('/personnel-get-classroom-info-from-year', (req, res) => {
    const { Personnel_Email, Year } = req.query;

    // SQL query to get Year, Level, Room by Personnel_Email
    const sql = `
        SELECT Year, Level, Room
        FROM Class_Teacher
        WHERE Personnel_Email = ? AND Year = ?
    `;

    // Execute the SQL query to get Year, Level, Room
    connection.query(sql, [Personnel_Email, Year], (err, results) => {
        if (err) {
            console.error('Error querying class_teacher information:', err);
            return res.status(500).json({ error: 'Failed to retrieve class_teacher information' });
        }

        // Check if the class_teacher information is found
        if (results.length === 0) {
            return res.status(404).json({ error: 'Not found class of this class teacher' });
        }

        // Get Year, Level, Room from the first result
        const { Year, Level, Room } = results[0];

        // SQL query to get Student_ID by Year, Level, Room
        const classroomQuery = `
            SELECT Student_ID
            FROM classroom
            WHERE Year = ? AND Level = ? AND Room = ?
        `;

        // Execute the SQL query to get Student_ID
        connection.query(classroomQuery, [Year, Level, Room], (err, classroomResults) => {
            if (err) {
                console.error('Error querying classroom information:', err);
                return res.status(500).json({ error: 'Failed to retrieve classroom information' });
            }

            // Return the Student_ID results
            res.status(200).json(classroomResults);
        });
    });
});

// router.get('/get-student-info-by-id', (req, res) => {
//     const studentIDs = req.query; // รับข้อมูล Student_ID ที่ส่งมา

//     // ตรวจสอบว่ามีข้อมูล Student_ID ที่ส่งมาหรือไม่
//     if (!studentIDs || Object.keys(studentIDs).length === 0) {
//         return res.status(400).json({ error: 'No Student_ID provided' });
//     }

//     // สร้าง SQL query เพื่อคิวรี่ข้อมูลจากตาราง student
//     const sql = `
//         SELECT Student_ID, NameTitle, FirstName, LastName
//         FROM student
//         WHERE Student_ID IN (?)
//     `;

//     // ส่งคำสั่ง SQL query ไปยังฐานข้อมูล
//     connection.query(sql, [Object.values(studentIDs)], (err, results) => {
//         if (err) {
//             console.error('Error querying student information:', err);
//             return res.status(500).json({ error: 'Failed to retrieve student information' });
//         }

//         // ตรวจสอบว่ามีข้อมูลหรือไม่
//         if (results.length === 0) {
//             return res.status(404).json({ error: 'No student information found' });
//         }

//         // ส่งข้อมูลที่ได้กลับไปยังผู้ใช้งาน
//         res.status(200).json(results);
//     });
// });


router.post('/get-student-info-by-id', (req, res) => {
    const studentIDs = req.body; // รับข้อมูล Student_ID ที่ส่งมา

    // ตรวจสอบว่ามีข้อมูล Student_ID ที่ส่งมาหรือไม่
    if (!studentIDs || studentIDs.length === 0) {
        return res.status(400).json({ error: 'No Student_ID provided' });
    }

    // สร้าง SQL query เพื่อคิวรี่ข้อมูลจากตาราง student
    const sql = `
        SELECT Student_ID, NameTitle, FirstName, LastName
        FROM student
        WHERE Student_ID IN (?)
    `;

    // ส่งคำสั่ง SQL query ไปยังฐานข้อมูล
    connection.query(sql, [studentIDs.map(student => student.Student_ID)], (err, results) => {
        if (err) {
            console.error('Error querying student information:', err);
            return res.status(500).json({ error: 'Failed to retrieve student information' });
        }

        // ตรวจสอบว่ามีข้อมูลหรือไม่
        if (results.length === 0) {
            return res.status(404).json({ error: 'No student information found' });
        }

        // ส่งข้อมูลที่ได้กลับไปยังผู้ใช้งาน
        res.status(200).json(results);
    });
});



module.exports = router;