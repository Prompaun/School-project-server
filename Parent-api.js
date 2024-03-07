var express = require('express')
const router = express.Router();
require('dotenv').config();


const path = require("path");
const iconv = require('iconv-lite');
const { google } = require("googleapis");
const multer = require("multer"); // import multer ก่อน stream
const stream = require("stream"); // import stream หลังจาก multer
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const { Mutex } = require('async-mutex');
const mutex = new Mutex();

// get the client
const mysql = require('mysql2');
const connection = mysql.createConnection({
    host: process.env.HOST,
    user: process.env.USER,
    database: process.env.DATABASE,
    password: process.env.PASSWORD
  });

// ต่อ database หรือทำสิ่งอื่น ๆ ที่ต้องการกับค่า config
// var app = express()
// app.use(express.json());

// app.use(cors())

connection.connect((err) => {
  if((err)) {
    console.log('Error connecting to MySQL database =', err)
    return;
  }
  console.log('MySQL successfully connected!');
})

// CREATE Routes
router.post("/register", async (req, res) => {
//   const { Email, Password } = req.body;

  const data = req.body;

    if (!Array.isArray(data)) {
        return res.status(400).json({ error: "Invalid request body. Expecting an array of data." });
    }

    try {
        const values = data.map(item => [
            item.Email,
            item.Password
        ]);

      connection.query(
          "INSERT INTO parent_login(Email, Password) VALUES ?",
          [values],
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

//คิวรี่ข้อมูลของคนที่ล็อคอินอยู่มาแสดง
router.get("/user_information/:Email", async (req, res) => {
    const Email = req.params.Email;

    try {
        connection.query(
            "SELECT Avatar, FirstName, LastName, Email FROM Parent WHERE Email = ?",
            [Email],
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


const KEYFILEPATH = path.join(__dirname, "school-project-ggDrive.json");
const SCOPES = ["https://www.googleapis.com/auth/drive"];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

router.post("/upload", upload.any(), async (req, res) => {
    try {
            console.log("req.body", req.body);
            console.log("req.files", req.files);
            const { body, files } = req;

            // ดึงข้อมูลนักเรียนที่ส่งมาจากฟอร์ม
            const { Student_NID, NameTitle, FirstName, LastName, Student_DOB, Transcript_type, ParentEmail, HouseNumber, Moo, Soi, Road, Province, District, SubDistrict } = body;

            console.log("files",files);

            const transcriptFilesUrls = [];
            // อัปโหลดไฟล์ที่ส่งมาไปยัง Google Drive
            for (let f = 0; f < files.length; f += 1) {
                const data = await uploadFile(files[f]);
                transcriptFilesUrls.push(`https://drive.google.com/file/d/${data.id}`);
            }

            // ตรวจสอบว่ามี URL ของไฟล์ที่อัปโหลดพอสำหรับการเข้าถึงหรือไม่
            if (transcriptFilesUrls.length >= 4) {
                // เรียกใช้งานฟังก์ชันเพื่อเพิ่มข้อมูลลงในฐานข้อมูล
                await addApplicantToDatabase(Student_NID, NameTitle, FirstName, LastName, Student_DOB, transcriptFilesUrls[0], HouseNumber, Moo, Soi, Road, Province, District, SubDistrict, Transcript_type, transcriptFilesUrls[1], transcriptFilesUrls[2], transcriptFilesUrls[3], ParentEmail);
                res.status(200).send("Form Submitted");
            } else {
                // จัดการข้อผิดพลาดหาก URL ของไฟล์ไม่เพียงพอ
                console.error("Not enough transcript file URLs for accessing.");
                // ส่งคำตอบเฉพาะข้อผิดพลาดกลับไป
                res.status(500).json({ error: "Not enough transcript file URLs for accessing." });
            }

            // อัปโหลดไฟล์ที่ส่งมาไปยัง Google Drive
            // for (let f = 0; f < files.length; f += 1)
            // {
            //     // await uploadFile(files[f]);
            //     const data = await uploadFile(files[f]);

            // }

            // res.status(200).send("Form Submitted");

            // const Transcript_file = `https://drive.google.com/file/d/${data.id}`;


            // เพิ่มข้อมูลนักเรียนลงในฐานข้อมูล
            // await addApplicantToDatabase(Student_NID, NameTitle, FirstName, LastName, Student_DOB, transcriptFilesUrls[0], House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, transcriptFilesUrls[1], transcriptFilesUrls[2], HouseReg_file, ParentEmail);
            // res.status(200).send("Form Submitted");
        }   
        catch (error) {
            if (error.status && error.message) {
                return res.status(error.status).json({ error: error.message });
            } else {
                console.error(error);
                return res.status(500).send();
            }
        }
    });

    const uploadFile = async (fileObject) => {
        const bufferStream = new stream.PassThrough();
        bufferStream.end(fileObject.buffer);
        // ใช้ iconv-lite ในการ decode ชื่อไฟล์
        const originalFilename = iconv.decode(Buffer.from(fileObject.originalname, 'binary'), 'utf-8');
        console.log('originalFilename', originalFilename);
        const { data } = await google.drive({ version: "v3", auth }).files.create({
            media: {
                mimeType: fileObject.mimeType,
                body: bufferStream,
            },
            requestBody: {
                name: originalFilename,
                parents: ["1r4FBXi6cFjxg_WXNiMX9mQQ1EJHmeIyw"],
            },
            fields: "id,name",
        });
        console.log(`Uploaded file ${data.name} ${data.id}`);
        console.log(`https://drive.google.com/file/d/${data.id}`);
        return data;
    };

    const addApplicantToDatabase = async (Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file, ParentEmail) => {
        return new Promise((resolve, reject) => {
            connection.query(
                "INSERT INTO Applicant (Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file, ParentEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file, ParentEmail],
                (err, results, fields) => {
                    if (err) {
                        if (err.code === 'ER_DUP_ENTRY') {
                            reject({ status: 409, message: "Identification number already exists." });
                        } else {
                            console.log("Error while inserting student information into the database", err);
                            reject({ status: 400, message: err.message });
                        }
                    } else {
                        resolve({ status: 201, message: "Student information successfully recorded!" });
                    }
                }
            );
        });
    };

    router.get('/check-email', (req, res) => {
        const { email } = req.query;
        console.log(email);
        // const email = "parent3@example.com";
      
        // สร้าง query SQL เพื่อค้นหาอีเมลในฐานข้อมูล
        const query = 'SELECT * FROM parent WHERE Email = ?';
        
        // ส่ง query ไปยังฐานข้อมูล
        connection.query(query, [email], (err, results) => {
          if (err) {
            console.error('Error querying database:', err);
            return res.status(500).json({ error: 'Database error' });
          }
      
          // ตรวจสอบว่ามีผลลัพธ์จาก query หรือไม่
          if (results.length > 0) {
            // พบอีเมลในฐานข้อมูล
            // res.json({ results: results });
            res.json({ results });
            // res.json({ found: true });
          } else {
            // ไม่พบอีเมลในฐานข้อมูล
            res.json({ found: false });
          }
        });
      });






//นำข้อมูลผู้สมัครลงฐานข้อมูล
router.post("/NewStudent_information", async (req, res) => {
    const { 
        Applicant_ID, 
        Student_NID, 
        NameTitle, 
        FirstName, 
        LastName, 
        Student_DOB, 
        Avatar, 
        House_No,
        Moo,
        Soi,
        Road,
        Province,
        District,
        Sub_District,
        Transcript_type, 
        Transcript_file, 
        BirthCert_file, 
        HouseReg_file,
        ParentEmail 
    } = req.body;

    try {
        connection.query(
            "INSERT INTO Applicant (Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file, ParentEmail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, House_No, Moo, Soi, Road, Province, District, Sub_District, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file, ParentEmail],
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
//     const { 
//         Applicant_ID, 
//         Student_NID, 
//         NameTitle, 
//         FirstName, 
//         LastName, 
//         Student_DOB, 
//         Avatar, 
//         ParentEmail, 
//         Transcript_type, 
//         Transcript_file, 
//         BirthCert_file, 
//         HouseReg_file 
//     } = req.body;

//     try {
//         connection.query(
//             "INSERT INTO Applicant (Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, ParentEmail, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
//             [Applicant_ID, Student_NID, NameTitle, FirstName, LastName, Student_DOB, Avatar, ParentEmail, Transcript_type, Transcript_file, BirthCert_file, HouseReg_file],
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

//กำหนดเลข Applicant_ID ของผู้สมัคร จาก Student_NID
router.patch("/Define_Applicant_ID/:Student_NID", async (req, res) => {
    const Student_NID = req.params.Student_NID;
    const applicant_ID = req.body.applicant_ID;

    try {
        // เพิ่มเงื่อนไขสำหรับตรวจสอบว่ามี Student_NID ที่กำหนดหรือไม่
        connection.query("SELECT * FROM applicant WHERE Student_NID = ?", [Student_NID], (selectErr, selectResults, selectFields) => {
            if (selectErr) {
                console.log("Error while checking Student_NID in the database", selectErr);
                return res.status(500).json({ error: selectErr.message });
            }

            // ถ้าไม่พบ Student_NID
            if (selectResults.length === 0) {
                return res.status(404).json({ error: "Student with the provided ID not found." });
            }

            // ถ้าพบ Student_NID, ทำการอัปเดตข้อมูล
            connection.query("UPDATE applicant SET applicant_ID = ? WHERE Student_NID = ?", [applicant_ID, Student_NID], (err, results, fields) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        return res.status(409).json({ error: "applicant id already exists." });
                    } else {
                        console.log("Error while updating student information in the database", err);
                        return res.status(400).json({ error: err.message });
                    }
                }
                return res.status(200).json({ message: "Student information successfully updated!" });
            });
        });
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});


//นำข้อมูลของผู้ปกครองผู้สมัครลงฐานข้อมูล
router.post("/Parent_information", async (req, res) => {
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

//นำข้อมูลทะเบียนบ้านของผู้สมัครลงฐานข้อมูล
router.post("/Household_information", async (req, res) => {
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

router.post('/add-parent-emails', (req, res) => {
    const { Student_NID, first_ParentEmail, second_ParentEmail, third_ParentEmail } = req.body;

    const query = 'INSERT INTO Applicant_ParentEmail (Student_NID, first_ParentEmail, second_ParentEmail, third_ParentEmail) VALUES (?, ?, ?, ?)';
    
    connection.query(query, [Student_NID, first_ParentEmail, second_ParentEmail, third_ParentEmail], (err, results) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                // Duplicate entry error
                return res.status(409).json({ error: "Email already exists." });
            }
            else{
                console.error('Error adding parent emails:', err);
                return res.status(500).json({ error: 'Failed to add parent emails' });
            }
        }
        return res.status(200).json({ message: 'Parent emails added successfully' });
    });
});

router.get('/enrollment', (req, res) => {
    const { Student_NID, Enroll_Year, Enroll_Course } = req.query;
    const sql = `SELECT * FROM Enrollment WHERE Student_NID = ? AND Enroll_Year = ? AND Enroll_Course = ?`;
  
    connection.query(sql, [Student_NID, Enroll_Year, Enroll_Course], (err, results) => {
      if (err) {
        console.error('Error retrieving enrollment data:', err);
        res.status(500).json({ error: 'An error occurred while retrieving enrollment data' });
      } else {
        res.status(200).json(results);
      }
    });
  });

// //เพิ่มข้อมูลผู้สมัครลงฐานข้อมูล
// router.post('/addApplicant', (req, res) => {
//     const applicantData = {
//         Student_NID: req.body.Student_NID,
//         NameTitle: req.body.NameTitle,
//         FirstName: req.body.FirstName,
//         LastName: req.body.LastName,
//         Student_DOB: req.body.Student_DOB,
//         Avatar: req.body.Avatar,
//         House_No: req.body.House_No,
//         Moo: req.body.Moo,
//         Soi: req.body.Soi,
//         Road: req.body.Road,
//         Province: req.body.Province,
//         District: req.body.District,
//         Sub_District: req.body.Sub_District,
//         Transcript_type: req.body.Transcript_type,
//         Transcript_file: req.body.Transcript_file,
//         BirthCert_file: req.body.BirthCert_file,
//         HouseReg_file: req.body.HouseReg_file,
//         ParentEmail: req.body.ParentEmail
//     };

//     // Insert data into Applicant table
//     connection.query('INSERT INTO Applicant SET ?', applicantData, (error, applicantResult, fields) => {
//         if (error) {
//             console.error('Error inserting data into Applicant table: ' + error.message);
//             return res.status(500).json({ error: 'Error inserting data into Applicant database' });
//         }

//         console.log('Applicant data inserted successfully');
        
//         // Insert data into Applicant_ParentEmail table
//         const applicantID = applicantResult.insertId;
//         const parentEmailData = {
//             Student_NID: req.body.Student_NID,
//             Applicant_ID: applicantID,
//             first_ParentEmail: req.body.first_ParentEmail,
//             second_ParentEmail: req.body.second_ParentEmail,
//             third_ParentEmail: req.body.third_ParentEmail
//         };

//         connection.query('INSERT INTO Applicant_ParentEmail SET ?', parentEmailData, (err, parentEmailResult, fields) => {
//             if (err) {
//                 console.error('Error inserting data into Applicant_ParentEmail table: ' + err.message);
//                 return res.status(500).json({ error: 'Error inserting data into database' });
//             }

//             console.log('Parent email data inserted successfully');
//             return res.status(200).json({ message: 'Data inserted successfully' });
//         });
//     });
// });

//เพิ่มข้อมูบลผู้สมัครลงฐานข้อมูล
router.post('/addApplicant', async (req, res) => {
    const applicantData = {
        Student_NID: req.body.Student_NID,
        NameTitle: req.body.NameTitle,
        FirstName: req.body.FirstName,
        LastName: req.body.LastName,
        Student_DOB: req.body.Student_DOB,
        Avatar: req.body.Avatar,
        House_No: req.body.House_No,
        Moo: req.body.Moo,
        Soi: req.body.Soi,
        Road: req.body.Road,
        Province: req.body.Province,
        District: req.body.District,
        Sub_District: req.body.Sub_District,
        Transcript_type: req.body.Transcript_type,
        Transcript_file: req.body.Transcript_file,
        BirthCert_file: req.body.BirthCert_file,
        HouseReg_file: req.body.HouseReg_file,
        ParentEmail: req.body.ParentEmail
    };

    try {
        const release = await mutex.acquire();
        try {
            // Insert data into Applicant table
            const applicantResult = await insertApplicant(applicantData);
            
            // Insert data into Applicant_ParentEmail table
            await insertParentEmail(applicantData.Student_NID, applicantResult.insertId, req.body.first_ParentEmail, req.body.second_ParentEmail, req.body.third_ParentEmail);
            
            console.log('Data inserted successfully');
            return res.status(200).json({ message: 'Data inserted successfully' });
        } finally {
            release();
        }
    } catch (error) {
        console.error('Error inserting data:', error);
        return res.status(500).json({ error: 'Error inserting data into database' });
    }
});

async function insertApplicant(data) {
    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO Applicant SET ?', data, (error, result, fields) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

async function insertParentEmail(studentNID, applicantID, firstParentEmail, secondParentEmail, thirdParentEmail) {
    const parentEmailData = {
        Student_NID: studentNID,
        Applicant_ID: applicantID,
        first_ParentEmail: firstParentEmail,
        second_ParentEmail: secondParentEmail,
        third_ParentEmail: thirdParentEmail
    };

    return new Promise((resolve, reject) => {
        connection.query('INSERT INTO Applicant_ParentEmail SET ?', parentEmailData, (error, result, fields) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
    });
}

// คิวรี่ข้อมูลการสมัครเรียนด้วย applicantId
// router.get("/CheckEnroll_status/:applicantId", async (req, res) => {
//     const applicantId = req.params.applicantId;

//     try {
//         connection.query(
//             "SELECT app.NameTitle, app.FirstName, app.LastName, app.Student_NID, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course, enroll.Enroll_Status FROM applicant AS app JOIN enrollment AS enroll ON app.Applicant_ID = enroll.Enroll_ID WHERE app.Applicant_ID = ?",
//             [applicantId],
//             (err, results, fields) => {
//                 if (err) {
//                     console.log("Error while retrieving data from the database", err);
//                     return res.status(500).json({ error: err.message });
//                 }

//                 if (results.length === 0) {
//                     return res.status(404).json({ error: "Applicant not found" });
//                 }

//                 // Map through the results array to format the data
//                 const formattedData = results.map(result => ({
//                     NameTitle: result.NameTitle,
//                     FirstName: result.FirstName,
//                     LastName: result.LastName,
//                     Student_NID: result.Student_NID,
//                     Enroll_No: result.Enroll_ID,
//                     // Enroll_No: result.Enroll_No,
//                     Enroll_Year: result.Enroll_Year,
//                     Enroll_Course: result.Enroll_Course,
//                     Enroll_Status: result.Enroll_Status
//                 }));

//                 return res.status(200).json(formattedData);
//             }
//         );
//     } catch (err) {
//         console.log(err);
//         return res.status(500).send();
//     }
// });

// คิวรี่ข้อมูลการสมัครเรียนด้วย เลขที่ผู้สมัคร ปี และหลักสูตร
router.get("/CheckEnroll_status", async (req, res) => {
    const Enroll_ID = req.query.Enroll_ID;
    const Enroll_Year = req.query.Enroll_Year;
    const Enroll_Course = req.query.Enroll_Course;

    try {
        connection.query(
            "SELECT app.NameTitle, app.FirstName, app.LastName, app.Student_NID, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course, enroll.Enroll_Status FROM applicant AS app JOIN enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE enroll.Student_NID = ? AND enroll.Enroll_Year = ? AND enroll.Enroll_Course = ?",
            [Enroll_ID, Enroll_Year, Enroll_Course],
            (err, results, fields) => {
                if (err) {
                    console.log("Error while retrieving data from the database", err);
                    return res.status(500).json({ error: err.message });
                }

                if (results.length === 0) {
                    return res.status(404).json({ error: "Applicant not found" });
                }

                // Map through the results array to format the data
                const formattedData = results.map(result => ({
                    NameTitle: result.NameTitle,
                    FirstName: result.FirstName,
                    LastName: result.LastName,
                    Student_NID: result.Student_NID,
                    Enroll_No: result.Enroll_ID,
                    Enroll_Year: result.Enroll_Year,
                    Enroll_Course: result.Enroll_Course,
                    Enroll_Status: result.Enroll_Status
                }));

                return res.status(200).json(formattedData);
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});

//คิวรี่ข้อมูลของผู้สมัครจาก parentEmail สำหรับนำมาแสดงบน dropdown
router.get("/dropdownArray_EnrollStatus/:parentEmail", async (req, res) => {
    const parentEmail = req.params.parentEmail;

    try {
        // Query to get Student_NIDs from Applicant_ParentEmail table based on the provided ParentEmail
        connection.query(
            "SELECT Student_NID FROM Applicant_ParentEmail WHERE first_ParentEmail = ? OR second_ParentEmail = ? OR third_ParentEmail = ?",
            [parentEmail, parentEmail, parentEmail],
            (err, parentEmailResults, fields) => {
                if (err) {
                    console.log("Error while retrieving data from the database", err);
                    return res.status(500).json({ error: err.message });
                }

                if (parentEmailResults.length === 0) {
                    return res.status(404).json({ error: "No applicant found with this email" });
                }

                const studentNIDs = parentEmailResults.map(result => result.Student_NID);

                // Query to fetch details from Applicant table based on the obtained Student_NIDs
                connection.query(
                    "SELECT app.FirstName, app.LastName, enroll.Enroll_ID, enroll.Student_NID, enroll.Enroll_Year, enroll.Enroll_Course FROM Applicant AS app INNER JOIN Enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE app.Student_NID IN (?)",
                    [studentNIDs], // ใส่ค่า studentNIDs เข้าไปในพารามิเตอร์นี้
                    (err, applicantResults, fields) => {
                        // ตราบเท่าที่คำสั่ง SQL นี้ถูกเรียกใช้ด้วยค่า studentNIDs ที่ถูกส่งมาในพารามิเตอร์ของ query มันจะทำงานได้ถูกต้อง
                        if (err) {
                            console.log("Error while retrieving data from the database", err);
                            return res.status(500).json({ error: err.message });
                        }
                        
                        if (applicantResults.length === 0) {
                            return res.status(404).json({ error: "No applicant details found" });
                        }
                
                        // Prepare the data in the desired format
                        const formattedData = {
                            array: Array.from(new Set(applicantResults.map(result => result.Student_NID))),
                            // array: applicantResults.map(result => result.Student_NID),
                            Name: Array.from(new Set(applicantResults.map(result => result.FirstName + " " + result.LastName))),
                            // Name: applicantResults.map(result => result.FirstName + " " + result.LastName),
                            Enroll_ID: Array.from(new Set(applicantResults.map(result => result.Enroll_ID))),
                            Enroll_Year: Array.from(new Set(applicantResults.map(result => result.Enroll_Year))),
                            Enroll_Course: Array.from(new Set(applicantResults.map(result => result.Enroll_Course)))
                        };
                
                        return res.status(200).json([formattedData]);
                    }
                );
                
                
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});

//คิวรี่สำหรับหาข้อมูลของผู้สมัคร เพื่อที่จะนำมาใช้ในการแสดงข้อมูลการสมัครเรียน แบบ default --> ไม่ใช้แล้ว**
// router.get("/defaultData_EnrollStatus/:parentEmail", async (req, res) => {
//     const parentEmail = req.params.parentEmail;

//     try {
//         // Query to get Student_NIDs from Applicant_ParentEmail table based on the provided ParentEmail
//         connection.query(
//             "SELECT Student_NID FROM Applicant_ParentEmail WHERE first_ParentEmail = ? OR second_ParentEmail = ? OR third_ParentEmail = ?",
//             [parentEmail, parentEmail, parentEmail],
//             (err, parentEmailResults, fields) => {
//                 if (err) {
//                     console.log("Error while retrieving data from the database", err);
//                     return res.status(500).json({ error: err.message });
//                 }

//                 if (parentEmailResults.length === 0) {
//                     return res.status(404).json({ error: "No applicant found with this email" });
//                 }

//                 const studentNIDs = parentEmailResults.map(result => result.Student_NID);

//                 // Query to fetch details from Applicant table based on the obtained Student_NIDs
//                 connection.query(
//                     "SELECT app.FirstName, app.LastName, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course FROM Applicant AS app INNER JOIN Enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE app.Student_NID IN (?)",
//                     [studentNIDs],
//                     (err, applicantResults, fields) => {
//                         if (err) {
//                             console.log("Error while retrieving data from the database", err);
//                             return res.status(500).json({ error: err.message });
//                         }
                
//                         if (applicantResults.length === 0) {
//                             return res.status(404).json({ error: "No applicant details found" });
//                         }

//                         // Prepare the data in the desired format
//                         // Convert to Set to remove duplicates
//                         const formattedData = {
//                             // array: Array.from(new Set(studentNIDs)), 
//                             array: Array.from(studentNIDs), 
//                             Name: Array.from(new Set(applicantResults.map(result => result.FirstName + " " + result.LastName))),
//                             Enroll_ID: Array.from(new Set(applicantResults.map(result => result.Enroll_ID))),
//                             Enroll_Year: Array.from(new Set(applicantResults.map(result => result.Enroll_Year))),
//                             Enroll_Course: Array.from(new Set(applicantResults.map(result => result.Enroll_Course)))
//                         };

//                         // Query to find the maximum Enroll_Year
//                         const maxEnrollYear = Math.max(...formattedData.Enroll_Year);
//                         const maxEnrollID = Math.max(...formattedData.Enroll_ID);
                        
//                         // Count unique values of Enroll_Course
//                         const uniqueEnrollCourses = new Set(formattedData.Enroll_Course);
//                         const courseCount = uniqueEnrollCourses.size;

//                         // Prepare the final response
//                         const finalResponse = [{
//                             Enroll_ID: maxEnrollID.toString(),
//                             Enroll_Year: maxEnrollYear.toString(),
//                             Enroll_Course: courseCount === 1 ? Array.from(uniqueEnrollCourses)[0] : (courseCount >= 2 ? "หลักสูตรปกติ" : "ไม่พบข้อมูลการสมัครเรียน")
//                         }];

//                         return res.status(200).json(finalResponse);
//                     }
//                 );
                
//             }
//         );
//     } catch (err) {
//         console.log(err);
//         return res.status(500).send();
//     }
// });

//แสดงข้อมูลหน้าตรวจสอบสถานะการสมัครเรียนแบบ default แสดงข้อมูลการสมัครเรียนของผู้สมัครทุกคน ในทุกปีการศึกษา และหลักสูตร
router.get("/DropdownData_EnrollStatus/:parentEmail", async (req, res) => {
    const parentEmail = req.params.parentEmail;

    try {
        // Query to get Student_NIDs from Applicant_ParentEmail table based on the provided ParentEmail
        connection.query(
            "SELECT Student_NID FROM Applicant_ParentEmail WHERE first_ParentEmail = ? OR second_ParentEmail = ? OR third_ParentEmail = ?",
            [parentEmail, parentEmail, parentEmail],
            (err, parentEmailResults, fields) => {
                if (err) {
                    console.log("Error while retrieving data from the database", err);
                    return res.status(500).json({ error: err.message });
                }

                if (parentEmailResults.length === 0) {
                    return res.status(404).json({ error: "No applicant found with this email" });
                }

                const studentNIDs = parentEmailResults.map(result => result.Student_NID);

                // Query to fetch details from Applicant table based on the obtained Student_NIDs
                connection.query(
                    "SELECT app.NameTitle, app.FirstName, app.LastName, app.Student_NID, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course, enroll.Enroll_Status FROM Applicant AS app INNER JOIN Enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE app.Student_NID IN (?)",
                    [studentNIDs],
                    (err, applicantResults, fields) => {
                        if (err) {
                            console.log("Error while retrieving data from the database", err);
                            return res.status(500).json({ error: err.message });
                        }

                        const formattedData = applicantResults.map(applicantResults => ({
                            NameTitle: applicantResults.NameTitle,
                            FirstName: applicantResults.FirstName,
                            LastName: applicantResults.LastName,
                            Student_NID: applicantResults.Student_NID,
                            Enroll_No: applicantResults.Enroll_ID,
                            Enroll_Year: applicantResults.Enroll_Year,
                            Enroll_Course: applicantResults.Enroll_Course,
                            Enroll_Status: applicantResults.Enroll_Status
                        }));
                
                        return res.status(200).json(formattedData);
                    }
                );
                
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});

//แสดงข้อมูลหน้าตรวจสอบสถานะการสมัครเรียนแบบ default เลือกแสดงจากผู้สมัครคนล่าสุด
router.get("/defaultData_EnrollStatus/:parentEmail", async (req, res) => {
    const parentEmail = req.params.parentEmail;

    try {
        // Query to get Student_NIDs from Applicant_ParentEmail table based on the provided ParentEmail
        connection.query(
            "SELECT Student_NID FROM Applicant_ParentEmail WHERE first_ParentEmail = ? OR second_ParentEmail = ? OR third_ParentEmail = ?",
            [parentEmail, parentEmail, parentEmail],
            (err, parentEmailResults, fields) => {
                if (err) {
                    console.log("Error while retrieving data from the database", err);
                    return res.status(500).json({ error: err.message });
                }

                if (parentEmailResults.length === 0) {
                    return res.status(404).json({ error: "No applicant found with this email" });
                }

                const studentNIDs = parentEmailResults.map(result => result.Student_NID);

                // Query to fetch details from Applicant table based on the obtained Student_NIDs
                connection.query(
                    "SELECT app.FirstName, app.LastName, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course FROM Applicant AS app INNER JOIN Enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE app.Student_NID IN (?)",
                    [studentNIDs],
                    (err, applicantResults, fields) => {
                        if (err) {
                            console.log("Error while retrieving data from the database", err);
                            return res.status(500).json({ error: err.message });
                        }
                
                        if (applicantResults.length === 0) {
                            return res.status(404).json({ error: "No applicant details found" });
                        }

                        // Prepare the data in the desired format
                        // Convert to Set to remove duplicates
                        const formattedData = {
                            array: Array.from(studentNIDs), 
                            Name: Array.from(new Set(applicantResults.map(result => result.FirstName + " " + result.LastName))),
                            Enroll_ID: Array.from(new Set(applicantResults.map(result => result.Enroll_ID))),
                            Enroll_Year: Array.from(new Set(applicantResults.map(result => result.Enroll_Year))),
                            Enroll_Course: Array.from(new Set(applicantResults.map(result => result.Enroll_Course)))
                        };

                        // Query to find the maximum Enroll_Year
                        const maxEnrollYear = Math.max(...formattedData.Enroll_Year);
                        const maxEnrollID = Math.max(...formattedData.Enroll_ID);
                        
                        // Count unique values of Enroll_Course
                        const uniqueEnrollCourses = new Set(formattedData.Enroll_Course);
                        const courseCount = uniqueEnrollCourses.size;

                        // Prepare the final response
                        const finalResponse = [{
                            Enroll_ID: maxEnrollID.toString(),
                            Enroll_Year: maxEnrollYear.toString(),
                            Enroll_Course: courseCount === 1 ? Array.from(uniqueEnrollCourses)[0] : (courseCount >= 2 ? "หลักสูตรปกติ" : "ไม่พบข้อมูลการสมัครเรียน")
                        }];

                        // Now, using the Enroll_ID from the finalResponse, proceed with the next query
                        const enrollID = finalResponse[0].Enroll_ID;
                        connection.query(
                            "SELECT app.NameTitle, app.FirstName, app.LastName, app.Student_NID, enroll.Enroll_ID, enroll.Enroll_Year, enroll.Enroll_Course, enroll.Enroll_Status FROM Applicant AS app JOIN Enrollment AS enroll ON app.Student_NID = enroll.Student_NID WHERE enroll.Enroll_ID = ?",
                            [enrollID],
                            (err, results, fields) => {
                                if (err) {
                                    console.log("Error while retrieving data from the database", err);
                                    return res.status(500).json({ error: err.message });
                                }

                                if (results.length === 0) {
                                    return res.status(404).json({ error: "Applicant not found" });
                                }

                                // Map through the results array to format the data
                                const formattedData = results.map(result => ({
                                    NameTitle: result.NameTitle,
                                    FirstName: result.FirstName,
                                    LastName: result.LastName,
                                    Student_NID: result.Student_NID,
                                    Enroll_No: result.Enroll_ID,
                                    Enroll_Year: result.Enroll_Year,
                                    Enroll_Course: result.Enroll_Course,
                                    Enroll_Status: result.Enroll_Status
                                }));

                                return res.status(200).json(formattedData);
                            }
                        );

                    }
                );
                
            }
        );
    } catch (err) {
        console.log(err);
        return res.status(500).send();
    }
});





module.exports = router;
// app.listen(5000, function () {
//     console.log('CORS-enabled web server listening on port 5000')
//   })