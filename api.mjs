/* =========================================================
   WebSound Academy - API (replaces all the PHP files)
   One Netlify Function that answers every /api/* request.

   Needs these environment variables (Netlify > Site settings > Environment variables):
     DATABASE_URL        mysql://USER:PASSWORD@HOST:PORT/DATABASE
     JWT_SECRET          a long random text (30+ characters)
     ADMIN_PASSWORD_HASH bcrypt hash of the admin password
   Optional (for the "forgot password" email):
     BREVO_API_KEY       API key from brevo.com
     MAIL_FROM           the sender email you verified in Brevo
     SITE_URL            example: https://websound.netlify.app
     DB_SSL              set to "false" only if your database does not use SSL
   ========================================================= */

import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

export const config = { path: "/api/*" };

/* ---------- limits ---------- */
const STUDENT_DAYS = 7;
const ADMIN_MINUTES = 30; // admin is logged out after 30 minutes without activity
const MAX_PDF = 4.5 * 1024 * 1024; // Netlify Functions accept request bodies up to about 6 MB
const MAX_IMAGE = 2 * 1024 * 1024;

/* =========================================================
   DATABASE
   ========================================================= */
let pool;
function db() {
  if (!pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    const u = new URL(process.env.DATABASE_URL);
    pool = mysql.createPool({
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace("/", ""),
      ssl: process.env.DB_SSL === "false" ? undefined : { rejectUnauthorized: false },
      charset: "utf8mb4",
      dateStrings: true,
      waitForConnections: true,
      connectionLimit: 3
    });
  }
  return pool;
}
async function query(sql, params = []) {
  const [rows] = await db().execute(sql, params);
  return rows;
}

/* =========================================================
   SIGNED LOGIN COOKIES (replace PHP sessions)
   ========================================================= */
function secret() {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
    throw new Error("JWT_SECRET is missing or too short.");
  }
  return process.env.JWT_SECRET;
}
const b64 = (buf) => Buffer.from(buf).toString("base64url");
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  return body + "." + mac;
}
function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, mac] = token.split(".");
  const good = crypto.createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(mac), c = Buffer.from(good);
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}
function readCookies(req) {
  const out = {};
  (req.headers.get("cookie") || "").split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function cookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}
const clearCookie = (name) => `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function studentFrom(req) {
  const p = verify(readCookies(req).ws_student);
  return p && p.role === "student" ? p : null;
}
function adminFrom(req) {
  const p = verify(readCookies(req).ws_admin);
  return p && p.role === "admin" ? p : null;
}
const adminCookie = () =>
  cookie("ws_admin", sign({ role: "admin", exp: Date.now() + ADMIN_MINUTES * 60 * 1000 }), ADMIN_MINUTES * 60);

/* =========================================================
   RESPONSE HELPERS
   ========================================================= */
function respond(body, status = 200, headers = {}, cookies = []) {
  const h = new Headers(headers);
  cookies.forEach((c) => h.append("Set-Cookie", c));
  return new Response(body, { status, headers: h });
}
const json = (obj, status = 200, cookies = []) =>
  respond(JSON.stringify(obj), status, { "Content-Type": "application/json; charset=UTF-8", "Cache-Control": "no-store" }, cookies);
const redirect = (to, cookies = []) => respond(null, 303, { Location: to }, cookies);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function messagePage(message, backHref, backText = "Go back") {
  return respond(
    `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WebSound Academy</title></head>
<body style="font-family:system-ui,Arial,sans-serif;background:#f5f7fb;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px">
<div style="background:#fff;max-width:420px;padding:32px;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.08);text-align:center">
<p style="color:#111827;line-height:1.6;margin:0 0 20px">${esc(message)}</p>
<a href="${esc(backHref)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:600">${esc(backText)}</a>
</div></body></html>`,
    400,
    { "Content-Type": "text/html; charset=UTF-8" }
  );
}
async function readForm(req) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return await req.json();
  const fd = await req.formData();
  const o = {};
  for (const [k, v] of fd.entries()) o[k] = v;
  return o;
}

/* =========================================================
   VALIDATION HELPERS
   ========================================================= */
const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const strongPassword = (p) =>
  p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
const PASSWORD_RULE =
  "Password must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character.";
const text = (v) => (typeof v === "string" ? v.trim() : "");

function youtubeId(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase();
    if (host.includes("youtu.be")) return u.pathname.split("/").filter(Boolean)[0] || "";
    if (host.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (["embed", "shorts"].includes(parts[0])) return parts[1] || "";
    }
  } catch { /* not a URL */ }
  return "";
}

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);
function detectImage(buf) {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return "png";
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.slice(8, 12).toString() === "WEBP") return "webp";
  return null;
}
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf" };

const uploads = () => getStore("uploads");
const randomName = () => `${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;

/* =========================================================
   PUBLIC: COURSES LIST  (was api/courses.php)
   ========================================================= */
async function listCourses() {
  const rows = await query(
    `SELECT id, course_name, description, category, thumbnail_url, price, is_free, created_at
     FROM courses ORDER BY created_at DESC, id DESC`
  );
  const courses = rows.map((r) => ({
    id: Number(r.id),
    course_name: r.course_name,
    title: r.course_name,
    description: r.description ?? "",
    category: r.category ?? "General",
    thumbnail_url: r.thumbnail_url ?? "",
    price: r.price ?? 0,
    is_free: Number(r.is_free ?? 0),
    created_at: r.created_at ?? ""
  }));
  return json({ success: true, courses, message: `${courses.length} course(s) loaded successfully.` });
}

/* =========================================================
   STUDENT: COURSE CONTENT  (was get-course-content.php)
   ========================================================= */
async function courseContent(req, url) {
  const response = { success: false, message: "", course: "", count: 0, content: [] };
  if (!studentFrom(req)) {
    response.message = "Student login required.";
    return json(response);
  }
  const course = text(url.searchParams.get("course") || "");
  if (!course) {
    response.message = "Course is required.";
    return json(response);
  }
  response.course = course;

  const items = await query(
    `SELECT id, course_name, lesson_title, content_type, title, youtube_url, youtube_id,
            thumbnail_url, content_text, external_url, created_at
     FROM course_content WHERE TRIM(course_name) = ? ORDER BY id ASC`,
    [course]
  );
  items.forEach((r) =>
    response.content.push({
      id: Number(r.id),
      course_name: r.course_name,
      lesson_title: r.lesson_title,
      content_type: String(r.content_type || "").trim().toLowerCase(),
      title: r.title ?? "",
      youtube_url: r.youtube_url ?? "",
      youtube_id: r.youtube_id ?? "",
      thumbnail_url: r.thumbnail_url ?? "",
      content_text: r.content_text ?? "",
      external_url: r.external_url ?? "",
      created_at: r.created_at ?? ""
    })
  );

  const notes = await query(
    `SELECT cn.id, cn.course_content_id, cn.note_title, cn.note_content, cn.created_at,
            cc.course_name, cc.lesson_title
     FROM course_notes cn INNER JOIN course_content cc ON cn.course_content_id = cc.id
     WHERE TRIM(cc.course_name) = ? ORDER BY cn.id ASC`,
    [course]
  );
  notes.forEach((n) =>
    response.content.push({
      id: Number(n.id),
      course_content_id: Number(n.course_content_id),
      course_name: n.course_name,
      lesson_title: n.lesson_title,
      content_type: "pdf",
      title: n.note_title,
      youtube_url: "",
      youtube_id: "",
      thumbnail_url: "",
      content_text: "",
      external_url: n.note_content,
      created_at: n.created_at
    })
  );

  response.success = true;
  response.count = response.content.length;
  response.message = response.count === 0 ? "No content found for this course." : "Course content loaded successfully.";
  return json(response);
}

/* =========================================================
   STUDENT: REGISTER / LOGIN / LOGOUT / ME
   ========================================================= */
async function register(req) {
  const f = await readForm(req);
  const fullName = text(f.full_name), email = text(f.email);
  const password = String(f.password || ""), confirm = String(f.confirm_password || "");

  const back = "/register.html";
  if (!fullName || !email || !password || !confirm) return messagePage("Please complete all fields.", back);
  if (fullName.length < 2) return messagePage("Please enter your full name.", back);
  if (!validEmail(email)) return messagePage("Please enter a valid email address.", back);
  if (password !== confirm) return messagePage("Passwords do not match.", back);
  if (!strongPassword(password)) return messagePage(PASSWORD_RULE, back);

  const exists = await query("SELECT id FROM students WHERE email = ? LIMIT 1", [email]);
  if (exists.length) return messagePage("An account with this email already exists.", "/login.html", "Go to log in");

  const hash = await bcrypt.hash(password, 10);
  const result = await db().execute("INSERT INTO students (full_name, email, password) VALUES (?, ?, ?)", [fullName, email, hash]);
  const id = result[0].insertId;

  const token = sign({ role: "student", id, name: fullName, email, exp: Date.now() + STUDENT_DAYS * 864e5 });
  return redirect("/login.html?registered=1", [cookie("ws_student", token, STUDENT_DAYS * 86400)]);
}

async function login(req) {
  const f = await readForm(req);
  const email = text(f.email), password = String(f.password || "");
  if (!email || !password) return redirect("/login.html?error=empty");
  if (!validEmail(email)) return redirect("/login.html?error=invalid");

  const rows = await query("SELECT id, full_name, email, password FROM students WHERE email = ? LIMIT 1", [email]);
  const s = rows[0];
  // PHP stored hashes start with $2y$, bcryptjs reads them as $2a$ (same algorithm)
  const ok = s && (await bcrypt.compare(password, s.password.replace(/^\$2y\$/, "$2a$")));
  if (!ok) return redirect("/login.html?error=invalid");

  const token = sign({ role: "student", id: s.id, name: s.full_name, email: s.email, exp: Date.now() + STUDENT_DAYS * 864e5 });
  return redirect("/welcome.html", [cookie("ws_student", token, STUDENT_DAYS * 86400)]);
}

const logout = () => redirect("/login.html", [clearCookie("ws_student")]);

function me(req) {
  const s = studentFrom(req);
  return json(s ? { loggedIn: true, name: s.name, email: s.email } : { loggedIn: false });
}

/* =========================================================
   STUDENT: FORGOT / RESET PASSWORD
   The old PHP version sent the reset link straight to the browser,
   so anyone could reset anyone's password. Now the link is emailed.
   ========================================================= */
async function sendEmail(to, subject, html) {
  if (!process.env.BREVO_API_KEY || !process.env.MAIL_FROM) {
    console.warn("Email not sent: BREVO_API_KEY or MAIL_FROM is not set.");
    return false;
  }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "WebSound Academy", email: process.env.MAIL_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html
    })
  });
  if (!r.ok) console.error("Brevo error", r.status, await r.text());
  return r.ok;
}

async function forgotPassword(req, url) {
  const f = await readForm(req);
  const email = text(f.email);
  if (!validEmail(email)) return messagePage("Please enter a valid email address.", "/forgot-password.html");

  const rows = await query("SELECT id, full_name FROM students WHERE email = ? LIMIT 1", [email]);
  if (rows.length) {
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await query(
      "UPDATE students SET reset_token_hash = ?, reset_expires = DATE_ADD(NOW(), INTERVAL 30 MINUTE), reset_attempts = 0 WHERE id = ?",
      [tokenHash, rows[0].id]
    );
    const site = (process.env.SITE_URL || url.origin).replace(/\/$/, "");
    const link = `${site}/reset-password.html?token=${token}`;
    await sendEmail(
      email,
      "Reset your WebSound Academy password",
      `<p>Hello ${esc(rows[0].full_name)},</p>
       <p>Click the button below to choose a new password. The link works for 30 minutes.</p>
       <p><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
       <p>If you did not ask for this, you can ignore this email.</p>`
    );
  }
  // Same answer whether the email exists or not
  return redirect("/login.html?reset=sent");
}

async function resetPassword(req) {
  const f = await readForm(req);
  const token = text(f.token), password = String(f.password || ""), confirm = String(f.confirm_password || "");
  const back = "/forgot-password.html";
  if (!token) return messagePage("This password reset link is invalid.", back, "Ask for a new link");

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const rows = await query("SELECT id FROM students WHERE reset_token_hash = ? AND reset_expires > NOW() LIMIT 1", [tokenHash]);
  if (!rows.length) return messagePage("This password reset link is invalid or has expired.", back, "Ask for a new link");

  const here = `/reset-password.html?token=${encodeURIComponent(token)}`;
  if (!password || !confirm) return messagePage("Please complete both password fields.", here);
  if (password !== confirm) return messagePage("Passwords do not match.", here);
  if (!strongPassword(password)) return messagePage(PASSWORD_RULE, here);

  const hash = await bcrypt.hash(password, 10);
  await query(
    "UPDATE students SET password = ?, reset_token_hash = NULL, reset_expires = NULL, reset_attempts = 0 WHERE id = ?",
    [hash, rows[0].id]
  );
  return redirect("/login.html?reset=success");
}

/* =========================================================
   ADMIN: LOGIN / LOGOUT
   ========================================================= */
async function adminLogin(req) {
  const f = await readForm(req);
  const password = String(f.password || "");
  const hash = (process.env.ADMIN_PASSWORD_HASH || "").replace(/^\$2y\$/, "$2a$");
  if (!hash) return messagePage("Admin password is not set on the server (ADMIN_PASSWORD_HASH).", "/admin-login.html");
  const ok = password && (await bcrypt.compare(password, hash));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // slows down password guessing
    return redirect("/admin-login.html?error=1");
  }
  return redirect("/admin.html", [adminCookie()]);
}
const adminLogout = () => redirect("/admin-login.html?logout=1", [clearCookie("ws_admin")]);

/* =========================================================
   ADMIN: DASHBOARD DATA  (was the PHP part at the top of admin.php)
   ========================================================= */
async function adminData(url) {
  const courses = await query("SELECT * FROM courses ORDER BY created_at DESC, id DESC");
  const [{ total }] = await query("SELECT COUNT(*) AS total FROM students");

  const out = { success: true, courses, totalStudents: Number(total), selectedCourse: null, videos: [], notes: [], quizzes: [] };

  const id = parseInt(url.searchParams.get("course") || "0", 10);
  if (id > 0) {
    const sel = (await query("SELECT * FROM courses WHERE id = ? LIMIT 1", [id]))[0];
    if (sel) {
      out.selectedCourse = sel;
      const content = await query("SELECT * FROM course_content WHERE course_name = ? ORDER BY id ASC", [sel.course_name]);
      out.videos = content.filter((r) => String(r.content_type).toLowerCase() === "video");
      out.quizzes = content.filter((r) => String(r.content_type).toLowerCase() === "quiz");
      out.notes = await query(
        `SELECT cn.*, cc.course_name, cc.lesson_title
         FROM course_notes cn INNER JOIN course_content cc ON cn.course_content_id = cc.id
         WHERE cc.course_name = ? ORDER BY cn.id ASC`,
        [sel.course_name]
      );
    }
  }
  return out;
}

async function courseNameById(id) {
  const rows = await query("SELECT course_name FROM courses WHERE id = ? LIMIT 1", [id]);
  return rows.length ? rows[0].course_name : null;
}

/* ---------- ADMIN: add course (with optional picture) ---------- */
async function addCourse(req) {
  const f = await readForm(req);
  const name = text(f.course_name);
  if (!name) return { success: false, message: "Please enter the course name." };

  let thumbnail = "";
  const file = f.thumbnail;
  if (file && typeof file === "object" && file.size > 0) {
    if (file.size > MAX_IMAGE) return { success: false, message: "The picture is too big. Use one smaller than 2 MB." };
    const buf = Buffer.from(await file.arrayBuffer());
    const kind = detectImage(buf);
    if (!kind) return { success: false, message: "Only JPG, PNG or WEBP pictures are allowed." };
    const key = `courses/${randomName()}.${kind}`;
    await uploads().set(key, buf, { metadata: { contentType: MIME[kind] } });
    thumbnail = `/api/file/${key}`;
  }

  await query(
    "INSERT INTO courses (course_name, description, category, thumbnail_url, price, is_free) VALUES (?, ?, ?, ?, ?, ?)",
    [name, text(f.description), text(f.category), thumbnail, Number(f.price) || 0, f.is_free ? 1 : 0]
  );
  return { success: true, message: "Course added successfully." };
}

/* ---------- ADMIN: delete course ---------- */
async function deleteCourse(req) {
  const f = await readForm(req);
  const id = parseInt(f.course_id || "0", 10);
  if (!(id > 0)) return { success: false, message: "Course not found." };
  const name = await courseNameById(id);
  if (name) {
    // also remove its lessons and notes so they do not come back if a course with the same name is made later
    await query("DELETE cn FROM course_notes cn INNER JOIN course_content cc ON cn.course_content_id = cc.id WHERE cc.course_name = ?", [name]);
    await query("DELETE FROM course_content WHERE course_name = ?", [name]);
  }
  await query("DELETE FROM courses WHERE id = ?", [id]);
  return { success: true, message: "Course deleted successfully." };
}

/* ---------- ADMIN: add YouTube video ---------- */
async function addVideo(req) {
  const f = await readForm(req);
  const courseId = parseInt(f.course_id || "0", 10);
  const lesson = text(f.lesson_title), title = text(f.video_title), link = text(f.youtube_url);
  if (!(courseId > 0) || !lesson || !title || !link) return { success: false, message: "Please complete all video fields." };

  const id = youtubeId(link);
  if (!id) return { success: false, message: "Invalid YouTube URL." };
  const courseName = await courseNameById(courseId);
  if (!courseName) return { success: false, message: "Course not found." };

  await query(
    `INSERT INTO course_content (course_name, lesson_title, content_type, title, youtube_url, youtube_id, thumbnail_url)
     VALUES (?, ?, 'video', ?, ?, ?, ?)`,
    [courseName, lesson, title, link, id, `https://img.youtube.com/vi/${id}/hqdefault.jpg`]
  );
  return { success: true, message: "YouTube video added successfully." };
}

/* ---------- ADMIN: add PDF notes ---------- */
async function addNotes(req) {
  const f = await readForm(req);
  const courseId = parseInt(f.course_id || "0", 10);
  const lesson = text(f.lesson_title), noteTitle = text(f.note_title);
  if (!(courseId > 0) || !lesson || !noteTitle) return { success: false, message: "Please complete the notes fields." };

  const file = f.notes_pdf;
  if (!file || typeof file !== "object" || !(file.size > 0)) return { success: false, message: "Please select a PDF file." };
  if (file.size > MAX_PDF) return { success: false, message: "The PDF is too big (maximum 4.5 MB). Make it smaller, or upload it to Google Drive and add it as a link." };
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.slice(0, 4).toString() !== "%PDF") return { success: false, message: "Only PDF files are allowed." };

  const courseName = await courseNameById(courseId);
  if (!courseName) return { success: false, message: "Course not found." };

  const key = `notes/${randomName()}.pdf`;
  await uploads().set(key, buf, { metadata: { contentType: "application/pdf" } });

  // notes are attached to a lesson row (same logic as before)
  let lessonRow = (await query("SELECT id FROM course_content WHERE course_name = ? AND lesson_title = ? LIMIT 1", [courseName, lesson]))[0];
  let lessonId;
  if (lessonRow) {
    lessonId = lessonRow.id;
  } else {
    const r = await db().execute(
      `INSERT INTO course_content (course_name, lesson_title, content_type, title, youtube_url, youtube_id, thumbnail_url)
       VALUES (?, ?, 'video', ?, '', '', '')`,
      [courseName, lesson, lesson]
    );
    lessonId = r[0].insertId;
  }
  await query("INSERT INTO course_notes (course_content_id, note_title, note_content) VALUES (?, ?, ?)", [lessonId, noteTitle, `/api/file/${key}`]);
  return { success: true, message: "PDF notes uploaded successfully." };
}

/* ---------- ADMIN: add quiz / assessment link ---------- */
async function addQuiz(req) {
  const f = await readForm(req);
  const courseId = parseInt(f.course_id || "0", 10);
  const lesson = text(f.lesson_title), title = text(f.quiz_title), link = text(f.quiz_url);
  if (!(courseId > 0) || !lesson || !title || !link) return { success: false, message: "Please complete all quiz fields." };
  try {
    const u = new URL(link);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error();
  } catch { return { success: false, message: "Please enter a valid quiz URL." }; }

  const courseName = await courseNameById(courseId);
  if (!courseName) return { success: false, message: "Course not found." };

  await query(
    `INSERT INTO course_content (course_name, lesson_title, content_type, title, youtube_url, youtube_id, thumbnail_url, external_url)
     VALUES (?, ?, 'quiz', ?, '', '', '', ?)`,
    [courseName, lesson, title, link]
  );
  return { success: true, message: "Quiz link added successfully." };
}

/* =========================================================
   ADMIN: create the database tables (first-time setup)
   Safe to run again: it never deletes or changes existing tables.
   ========================================================= */
const TABLES = [
  `CREATE TABLE IF NOT EXISTS students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(190) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    reset_token_hash VARCHAR(64) NULL,
    reset_expires DATETIME NULL,
    reset_attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(190) NOT NULL,
    description TEXT NULL,
    category VARCHAR(100) NULL,
    thumbnail_url VARCHAR(500) NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    is_free TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS course_content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_name VARCHAR(190) NOT NULL,
    lesson_title VARCHAR(190) NOT NULL,
    content_type VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL DEFAULT '',
    youtube_url VARCHAR(500) NOT NULL DEFAULT '',
    youtube_id VARCHAR(50) NOT NULL DEFAULT '',
    thumbnail_url VARCHAR(500) NOT NULL DEFAULT '',
    content_text MEDIUMTEXT NULL,
    external_url VARCHAR(1000) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_course_name (course_name)
  ) CHARACTER SET utf8mb4`,
  `CREATE TABLE IF NOT EXISTS course_notes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    course_content_id INT NOT NULL,
    note_title VARCHAR(255) NOT NULL,
    note_content VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_content (course_content_id)
  ) CHARACTER SET utf8mb4`
];

async function setupTables() {
  for (const sql of TABLES) await db().query(sql);
  return { success: true, message: "Done. The 4 tables are ready: students, courses, course_content, course_notes." };
}

/* =========================================================
   FILES uploaded by the admin (PDF notes and course pictures)
   ========================================================= */
async function serveFile(key) {
  if (!/^(notes|courses)\/[A-Za-z0-9_]+\.(pdf|jpg|png|webp)$/.test(key)) return respond("Not found", 404);
  const data = await uploads().get(key, { type: "arrayBuffer" });
  if (!data) return respond("Not found", 404);
  const ext = key.split(".").pop();
  return respond(data, 200, {
    "Content-Type": MIME[ext],
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=31536000, immutable"
  });
}

/* =========================================================
   ROUTER
   ========================================================= */
export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");
  const method = req.method;

  try {
    // public and student routes
    if (method === "GET" && path === "courses") return await listCourses();
    if (method === "GET" && path === "course-content") return await courseContent(req, url);
    if (method === "GET" && path === "me") return me(req);
    if (method === "POST" && path === "register") return await register(req);
    if (method === "POST" && path === "login") return await login(req);
    if (path === "logout") return logout();
    if (method === "POST" && path === "forgot-password") return await forgotPassword(req, url);
    if (method === "POST" && path === "reset-password") return await resetPassword(req);
    if (method === "GET" && path.startsWith("file/")) return await serveFile(path.slice(5));

    // admin login / logout
    if (method === "POST" && path === "admin-login") return await adminLogin(req);
    if (path === "admin-logout") return adminLogout();

    // admin routes (need the admin cookie)
    if (path.startsWith("admin/")) {
      if (!adminFrom(req)) return json({ success: false, message: "Please log in again.", expired: true }, 401, [clearCookie("ws_admin")]);
      const refreshed = [adminCookie()]; // keeps the 30-minute timer moving while the admin is active

      if (method === "GET" && path === "admin/data") return json(await adminData(url), 200, refreshed);

      if (method === "POST") {
        const actions = {
          "admin/course": addCourse,
          "admin/course-delete": deleteCourse,
          "admin/video": addVideo,
          "admin/notes": addNotes,
          "admin/quiz": addQuiz,
          "admin/setup": setupTables
        };
        if (actions[path]) return json(await actions[path](req), 200, refreshed);
      }
    }

    return json({ success: false, message: "Not found." }, 404);
  } catch (err) {
    console.error("API error on", method, path, err);
    return json({ success: false, message: "Server error. Please try again." }, 500);
  }
};
