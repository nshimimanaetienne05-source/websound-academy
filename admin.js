/* =========================================================
   WebSound Academy - Admin dashboard
   Loads data from /api/admin/data and sends forms to /api/admin/*
   ========================================================= */

var selectedCourseId = parseInt(new URLSearchParams(window.location.search).get("course") || "0", 10) || 0;
var adminData = null;

var ENDPOINTS = {
  add_course: "/api/admin/course",
  add_video: "/api/admin/video",
  add_notes: "/api/admin/notes",
  add_quiz: "/api/admin/quiz"
};

/* ---------- small helpers ---------- */
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// only allow safe links (http, https, or files on this site)
function safeUrl(url) {
  url = String(url || "").trim();
  if (/^https?:\/\//i.test(url) || url.indexOf("/") === 0 || /^uploads\//.test(url)) return esc(url);
  return "#";
}

function showAlert(message, isError) {
  var box = document.getElementById("alertBox");
  box.innerHTML =
    '<div class="alert"' + (isError ? ' style="background:#fee2e2;color:#b91c1c;border-color:#fecaca"' : "") + ">" +
    '<i class="fas ' + (isError ? "fa-circle-exclamation" : "fa-check-circle") + '"></i> ' + esc(message) + "</div>";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ---------- modals ---------- */
function openModal(id) { document.getElementById(id).classList.add("active"); }
function closeModal(id) { document.getElementById(id).classList.remove("active"); }
function openVideoModal() { openModal("videoModal"); }
function openQuizModal() { openModal("quizModal"); }

document.querySelectorAll(".modal").forEach(function (modal) {
  modal.addEventListener("click", function (event) {
    if (event.target === modal) modal.classList.remove("active");
  });
});

function generateAIQuiz() {
  var lesson = document.getElementById("quizLesson").value;
  var count = document.getElementById("quizQuestionCount").value;
  if (!lesson) { alert("Please select a lesson."); return; }
  alert("AI Quiz generation is ready for connection.\n\nLesson: " + lesson + "\nQuestions: " + count + "\n\nNext we connect the AI service.");
}

/* ---------- load data ---------- */
async function loadData() {
  var response = await fetch("/api/admin/data?course=" + selectedCourseId, { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) { window.location.href = "admin-login.html?timeout=1"; return; }
  var data = await response.json();
  if (!data.success) { showAlert((data.message || "Could not load the dashboard.") + " If this is the first time, open Setup database in the menu.", true); return; }
  adminData = data;
  render();
}

/* ---------- render ---------- */
function render() {
  var d = adminData;
  document.getElementById("statCourses").textContent = d.courses.length;
  document.getElementById("statStudents").textContent = d.totalStudents;
  document.getElementById("statVideos").textContent = d.videos.length;

  renderCourses(d.courses);
  renderEditor(d);

  // put the selected course id in the video / notes / quiz forms
  document.querySelectorAll('input[name="course_id"]').forEach(function (input) {
    input.value = d.selectedCourse ? d.selectedCourse.id : "";
  });

  // lessons list for the AI quiz modal
  var lessons = [];
  d.videos.forEach(function (v) { if (lessons.indexOf(v.lesson_title) === -1) lessons.push(v.lesson_title); });
  document.getElementById("quizLesson").innerHTML = lessons.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
}

function renderCourses(courses) {
  var box = document.getElementById("courseList");
  if (!courses.length) {
    box.innerHTML = '<div class="empty"><i class="fas fa-book-open"></i><p>No courses yet.</p></div>';
    return;
  }
  box.innerHTML = '<div class="course-grid">' + courses.map(function (c) {
    var image = c.thumbnail_url
      ? '<img src="' + safeUrl(c.thumbnail_url) + '" alt="' + esc(c.course_name) + '">'
      : '<div class="no-image"><i class="fas fa-book"></i></div>';
    return '<div class="course-card">' +
      '<div class="course-image">' + image + "</div>" +
      '<div class="course-body">' +
        "<small>" + esc(c.category || "Course") + "</small>" +
        "<h3>" + esc(c.course_name) + "</h3>" +
        "<p>" + esc(c.description || "") + "</p>" +
        '<div class="course-actions">' +
          '<a class="btn btn-primary" href="admin.html?course=' + parseInt(c.id, 10) + '#courses"><i class="fas fa-edit"></i> Manage</a>' +
          '<button class="btn btn-red" type="button" data-delete="' + parseInt(c.id, 10) + '" aria-label="Delete course"><i class="fas fa-trash"></i></button>' +
        "</div>" +
      "</div></div>";
  }).join("") + "</div>";

  box.querySelectorAll("[data-delete]").forEach(function (button) {
    button.addEventListener("click", function () { deleteCourse(button.getAttribute("data-delete")); });
  });
}

function noteRow(icon, title, lesson, href, label, iconStyle) {
  return '<div class="note-row"><div class="note-info">' +
    '<i class="' + icon + '"' + (iconStyle ? ' style="' + iconStyle + '"' : "") + "></i>" +
    "<div><strong>" + esc(title) + "</strong>" +
    '<div style="color:var(--muted);font-size:11px;margin-top:3px;">' + esc(lesson) + "</div></div></div>" +
    '<a href="' + safeUrl(href) + '" target="_blank" rel="noopener noreferrer" class="btn btn-light">' + label + "</a></div>";
}

function renderEditor(d) {
  var box = document.getElementById("editor");
  var c = d.selectedCourse;
  if (!c) { box.innerHTML = ""; return; }

  var videos = d.videos.length
    ? d.videos.map(function (v) {
        return '<div class="lesson"><div class="lesson-title">' + esc(v.lesson_title) + "</div>" +
          '<div class="video-row"><div class="video-info"><i class="fab fa-youtube"></i><span>' + esc(v.title) + "</span></div>" +
          (v.youtube_url ? '<a href="' + safeUrl(v.youtube_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-light">Watch</a>' : "") +
          "</div></div>";
      }).join("")
    : '<div class="empty">No videos added yet.</div>';

  var notes = d.notes.length
    ? d.notes.map(function (n) { return noteRow("fas fa-file-pdf", n.note_title, n.lesson_title, n.note_content, "Open PDF"); }).join("")
    : '<div class="empty">No PDF notes added yet.</div>';

  var quizzes = d.quizzes.length
    ? d.quizzes.map(function (q) { return noteRow("fas fa-clipboard-question", q.title, q.lesson_title, q.external_url, "Open Quiz", "color:var(--blue);"); }).join("")
    : '<div class="empty">No quiz links added yet.</div>';

  box.innerHTML =
    '<div class="panel">' +
      '<div class="editor-header"><div>' +
        '<a href="admin.html#courses" class="btn btn-light"><i class="fas fa-arrow-left"></i> All Courses</a>' +
        "<h2>" + esc(c.course_name) + "</h2><p>" + esc(c.description || "") + "</p>" +
      "</div></div>" +

      '<div class="content-card"><div class="panel-header"><h3><i class="fas fa-video"></i> Videos</h3>' +
        '<button class="btn btn-primary" type="button" onclick="openVideoModal()"><i class="fas fa-plus"></i> Add Video</button></div>' +
        videos + "</div>" +

      '<div class="content-card"><div class="panel-header"><h3><i class="fas fa-file-pdf"></i> Notes PDF</h3>' +
        '<button class="btn btn-primary" type="button" onclick="openModal(\'notesModal\')"><i class="fas fa-plus"></i> Add Notes PDF</button></div>' +
        notes + "</div>" +

      '<div class="content-card"><div class="ai-box">' +
        '<div class="content-card"><div class="panel-header"><h3><i class="fas fa-clipboard-question"></i> Quiz Links</h3>' +
          '<button class="btn btn-primary" type="button" onclick="openModal(\'quizLinkModal\')"><i class="fas fa-plus"></i> Add Quiz Link</button></div>' +
          quizzes + "</div>" +
        '<h3><i class="fas fa-robot"></i> AI Quiz Generator</h3>' +
        "<p>Generate quiz questions automatically from a lesson. We will connect the AI service to this button next.</p>" +
        '<button class="btn btn-primary" type="button" style="margin-top:15px;" onclick="openQuizModal()"><i class="fas fa-wand-magic-sparkles"></i> Generate AI Quiz</button>' +
      "</div></div>" +
    "</div>";

  if (window.location.hash === "#courses") {
    // keep the page where the admin was working
    var el = document.getElementById("courses");
    if (el && !window.__scrolled) { window.__scrolled = true; el.scrollIntoView(); }
  }
}

/* ---------- delete course ---------- */
async function deleteCourse(id) {
  if (!confirm("Delete this course and all its videos, notes and quiz links?")) return;
  var response = await fetch("/api/admin/course-delete", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: id })
  });
  if (response.status === 401) { window.location.href = "admin-login.html?timeout=1"; return; }
  var result = await response.json();
  showAlert(result.message, !result.success);
  if (result.success && String(selectedCourseId) === String(id)) {
    selectedCourseId = 0;
    history.replaceState(null, "", "admin.html#courses");
  }
  loadData();
}

/* ---------- forms in the modals ---------- */
document.querySelectorAll("form.ajax-form").forEach(function (form) {
  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    var action = form.querySelector('input[name="action"]').value;
    var endpoint = ENDPOINTS[action];
    var modal = form.closest(".modal");
    var button = form.querySelector('button[type="submit"]');

    // PDF too big? tell the admin before uploading
    var pdf = form.querySelector('input[name="notes_pdf"]');
    if (pdf && pdf.files[0] && pdf.files[0].size > 4.5 * 1024 * 1024) {
      alert("This PDF is bigger than 4.5 MB. Make it smaller, or upload it to Google Drive and add it as a link.");
      return;
    }

    var original = button ? button.innerHTML : "";
    if (button) { button.disabled = true; button.textContent = "Saving..."; }

    try {
      var response = await fetch(endpoint, { method: "POST", credentials: "same-origin", body: new FormData(form) });
      if (response.status === 401) { window.location.href = "admin-login.html?timeout=1"; return; }
      var result = await response.json();

      if (modal) modal.classList.remove("active");
      showAlert(result.message, !result.success);
      if (result.success) {
        form.reset();
        await loadData();
      }
    } catch (error) {
      showAlert("Could not save. Check your internet and try again.", true);
    } finally {
      if (button) { button.disabled = false; button.innerHTML = original; }
    }
  });
});

loadData();
