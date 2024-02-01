var express = require('express')
var cors = require('cors')
require('dotenv').config();

// get the client
const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    database: process.env.DATABASE,
    password: process.env.PASSWORD
  });

// ต่อ database หรือทำสิ่งอื่น ๆ ที่ต้องการกับค่า config
var app = express()
app.use(express.json());

app.use(cors())

connection.connect((err) => {
  if((err)) {
    console.log('Error connecting to MySQL database =', err)
    return;
  }
  console.log('MySQL successfully connected!');
})

// CREATE Routes
app.post("/register", async (req, res) => {
  const { Email, Password } = req.body;

  try {
      connection.query(
          "INSERT INTO parent_login(Email, Password) VALUES(?, ?)",
          [Email, Password],
          (err, results, fields) => {
              if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    // Duplicate entry error
                    return res.status(409).json({ error: "Email already exists. You are already registered." });
                } else {
                  console.log("Error while inserting a user into the database", err);
                  return res.status(400).json({ error: err.message });
                }
              }
              return res.status(201).json({ message: "New user successfully created!"});
          }
      )
  } catch(err) {
      console.log(err);
      return res.status(500).send();
  }
})

app.get("/user_information/:Parent_ID", async (req, res) => {
    const Parent_ID = req.params.Parent_ID;

    try {
        connection.query(
            "SELECT Avatar, FirstName, LastName, Email FROM Parent WHERE Parent_ID = ?",
            [Parent_ID],
            (err, results, fields) => {
                if (err) {
                    console.log(err);
                    return res.status(400).json({ error: err.message });
                }
                res.status(200).json(results);
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});


app.post("/NewStudent_information", async (req, res) => {
    const { 
        Applicant_ID, 
        Student_NID, 
        NameTitle, 
        FirstName, 
        LastName, 
        Student_DOB, 
        Avatar, 
        ParentEmail, 
        Transcript_type, 
        Transcript_file, 
        BirthCert_file, 
        HouseReg_file 
    } = req.body;

    try {
        connection.query(
            "INSERT INTO Applicant (Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, ParentEmail, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, ParentEmail, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file],
            (err, results, fields) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ error: "Identification number already exists." });
                    } else {
                        console.log("Error while inserting student information into the database", err);
                        return res.status(400).json({ error: err.message });
                    }
                }
                return res.status(201).json({ message: "Student information successfully recorded!" });
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});
// app.post("/NewStudent_information", async (req, res) => {
//     const data = req.body;

//     // Check if data is an array
//     if (!Array.isArray(data)) {
//         return res.status(400).json({ error: "Invalid request body. Expecting an array of data." });
//     }

//     try {
//         const values = data.map(item => [
//             item.Applicant_ID,
//             item.Student_NID,
//             item.NameTitle,
//             item.FirstName,
//             item.LastName,
//             item.Student_DOB,
//             item.Avatar,
//             item.ParentEmail,
//             item.Transcript_type,
//             item.Transcript_file,
//             item.BirthCert_file,
//             item.HouseReg_file
//         ]);

//         connection.query(
//             "INSERT INTO Applicant (Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, ParentEmail, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file) VALUES ?",
//             [values],
//             (err, results, fields) => {
//                 if (err) {
//                     if (err.code === 'ER_DUP_ENTRY') {
//                         return res.status(409).json({ error: "Identification number already exists." });
//                     } else {
//                         console.log("Error while inserting student information into the database", err);
//                         return res.status(400).json({ error: err.message });
//                     }
//                 }
//                 return res.status(201).json({ message: "Student information successfully recorded!" });
//             }
//         );
//     } catch (err) {
//         console.log(err);
//         return res.status(500).send();
//     }
// });



app.patch("/Define_Applicant_ID/:Student_NID", async (req, res) => {
    const Student_NID = req.params.Student_NID;
    const applicant_ID = req.body.applicant_ID;

    try {
        connection.query("UPDATE applicant SET applicant_ID = ? WHERE Student_NID = ?", [applicant_ID, Student_NID], (err, results, fields) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ error: "Identification number already exists." });
                    } else {
                        console.log("Error while inserting student information into the database", err);
                        return res.status(400).json({ error: err.message });
                    }
                }
                return res.status(201).json({ message: "Student information successfully recorded!" });
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});


app.post("/Parent_information", async (req, res) => {
    const data = req.body;

    if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid request body. Expecting an array of data." });
    }

    try {
        const values = data.map(item => [
            item.Avatar,
            item.Email,
            item.FirstName,
            item.LastName,
            item.Age,
            item.Nationality,
            item.Office,
            item.Occupation,
            item.Role,
            item.Tel
        ]);

        connection.query(
            "INSERT INTO Parent (Avatar, Email, FirstName, LastName, Age, Nationality, Office, Occupation, Role, Tel) VALUES ?",
            [values],
            (err, results, fields) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        // Duplicate entry error
                        return res.status(409).json({ error: "Email already exists." });
                    } else {
                        console.log("Error while inserting parent information into the database", err);
                        return res.status(400).json({ error: err.message });
                    }
                }
                return res.status(201).json({ message: "Parent information successfully recorded!" });
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});

app.post("/Household_information", async (req, res) => {
    const { 
        Applicant_ID,
        House_No,
        Moo,
        Soi,
        Road,
        Province,
        District,
        Sub_District
    } = req.body;

    try {
        connection.query(
            "INSERT INTO Household (Applicant_ID, House_No, Moo, Soi, Road, Province, District, Sub_District) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            [Applicant_ID, House_No, Moo, Soi, Road, Province, District, Sub_District],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while inserting household information into the database", err);
                    return res.status(400).json({ error: err.message });
                }
                return res.status(201).json({ message: "Household information successfully recorded!" });
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});



app.listen(5000, function () {
    console.log('CORS-enabled web server listening on port 5000')
  })