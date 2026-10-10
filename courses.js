/* =========================================================
   WEBSOUND ACADEMY
   DATABASE-DRIVEN COURSE SYSTEM
========================================================= */

let courses = [];
let currentCourse = null;
let currentLessonIndex = 0;
let allLessons = [];
let currentSlide = 0;
let sliderTimer = null;

/* =========================================================
   PAGE INITIALIZATION
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    loadCoursesFromDatabase();
    startSlider();
});

/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCoursesFromDatabase() {
    const courseContainer = document.getElementById("courseContainer");
    const featuredContainer = document.getElementById("featuredCourseContainer");

    if (courseContainer) {
        courseContainer.innerHTML = `
            <div class="loading-courses">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading courses...</p>
            </div>
        `;
    }

    try {
        const response = await fetch("/api/courses", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-cache"
        });

        if (!response.ok) {
            throw new Error("Could not connect to course API.");
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.message || "Could not load courses.");
        }

        courses = Array.isArray(data.courses) ? data.courses : [];

        prepareCourses();
        buildCategories();
        displayFeaturedCourses();
        displayCourses();
        setupCourseSearch();

 } catch (error) {
    console.error("Course loading error:", error);

    if (courseContainer) {
        courseContainer.innerHTML = `
            <style>
                .course-access-message {
                    width: min(92%, 620px);
                    margin: 80px auto;
                    padding: 45px 30px;
                    text-align: center;
                    background: #ffffff;
                    border-radius: 18px;
                    box-shadow: 0 10px 35px rgba(15, 23, 42, 0.08);
                    box-sizing: border-box;
                }

                .course-access-message .access-icon {
                    width: 68px;
                    height: 68px;
                    margin: 0 auto 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                    background: #eff6ff;
                    color: #2563eb;
                    font-size: 28px;
                }

                .course-access-message h2 {
                    margin: 0 0 12px;
                    color: #111827;
                    font-size: 24px;
                    font-weight: 700;
                }

                .course-access-message p {
                    margin: 0 auto 28px;
                    max-width: 480px;
                    color: #64748b;
                    font-size: 15px;
                    line-height: 1.7;
                }

                .course-access-message .access-buttons {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .course-access-message .access-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 140px;
                    padding: 12px 22px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.25s ease;
                    box-sizing: border-box;
                }

                .course-access-message .register-btn {
                    background: #2563eb;
                    color: #ffffff;
                    border: 1px solid #2563eb;
                }

                .course-access-message .register-btn:hover {
                    background: #1d4ed8;
                    transform: translateY(-2px);
                }

                .course-access-message .login-btn {
                    background: #ffffff;
                    color: #2563eb;
                    border: 1px solid #2563eb;
                }

                .course-access-message .login-btn:hover {
                    background: #eff6ff;
                    transform: translateY(-2px);
                }

                @media (max-width: 600px) {
                    .course-access-message {
                        width: calc(100% - 30px);
                        margin: 60px auto;
                        padding: 35px 20px;
                    }

                    .course-access-message h2 {
                        font-size: 20px;
                    }

                    .course-access-message p {
                        font-size: 14px;
                    }

                    .course-access-message .access-buttons {
                        flex-direction: column;
                        width: 100%;
                    }

                    .course-access-message .access-btn {
                        width: 100%;
                        max-width: 260px;
                    }
                }
            </style>

            <div class="course-access-message">

                <div class="access-icon">
                    <i class="fas fa-lock"></i>
                </div>

                <h2>Please Register or Log In</h2>

                <p>
                    Register for a WebSound Academy account or
                    log in to access our courses and start learning.
                </p>

                <div class="access-buttons">

                    <a
                        href="register.html"
                        class="access-btn register-btn">

                        <i
                            class="fas fa-user-plus"
                            style="margin-right: 8px;">
                        </i>

                        Register Now

                    </a>

                    <a
                        href="login.html"
                        class="access-btn login-btn">

                        <i
                            class="fas fa-right-to-bracket"
                            style="margin-right: 8px;">
                        </i>

                        Log In

                    </a>

                </div>

            </div>
        `;
    }

    if (featuredContainer) {
        featuredContainer.innerHTML = "";
    }
}

}

/* =========================================================
   PREPARE COURSES
========================================================= */

function prepareCourses() {
    courses = courses.map(function (course) {
        return {
            ...course,

            id: Number(course.id),

            title:
                course.title ||
                course.course_name ||
                "Untitled Course",

            category:
                course.category ||
                "General",

            description:
                course.description ||
                "",

            shortDescription:
                course.shortDescription ||
                course.short_description ||
                course.description ||
                "Start learning with WebSound Academy.",

            image:
                course.image ||
                course.thumbnail_url ||
                "images/courses/default-course.jpg",

            price:
                Number(course.price || 0),

            type:
                course.type ||
                (
                    Number(course.price || 0) === 0
                        ? "free"
                        : "premium"
                ),

            lessons:
                Number(course.lessons || 0),

            level:
                course.level ||
                "Beginner",

            duration:
                course.duration ||
                "",

            rating:
                course.rating ||
                "5.0"
        };
    });
}

/* =========================================================
   BUILD CATEGORY FILTERS
========================================================= */

function buildCategories() {
    const container = document.getElementById("categoryFilters");

    if (!container) return;

    const categories = [];

    courses.forEach(function (course) {
        const category = course.category || "General";

        if (!categories.includes(category)) {
            categories.push(category);
        }
    });

    categories.sort();

    container.innerHTML = `
        <button
            class="filter-btn active"
            onclick="filterCourses('all', this)">
            All
        </button>
    `;

    categories.forEach(function (category) {
        const button = document.createElement("button");

        button.className = "filter-btn";
        button.textContent = category;

        button.onclick = function () {
            filterCourses(category, button);
        };

        container.appendChild(button);
    });
}

/* =========================================================
   COURSE CARD
========================================================= */

function createCourseCard(course) {
    const card = document.createElement("div");

    card.className = "course-card-new";

    const isFree =
        course.type === "free" ||
        Number(course.price) === 0;

    const priceText =
        isFree
            ? "Free"
            : `${Number(course.price).toLocaleString()} RWF`;

    card.innerHTML = `
        <div class="course-image">

            <img
                src="${escapeAttribute(course.image)}"
                alt="${escapeAttribute(course.title)}"
                onerror="this.src='images/courses/default-course.jpg'">

            <span class="course-badge">
                ${isFree ? "FREE" : "PREMIUM"}
            </span>

        </div>

        <div class="course-content">

            <span class="course-category">
                ${escapeHTML(course.category)}
            </span>

            <h3>
                ${escapeHTML(course.title)}
            </h3>

            <p>
                ${escapeHTML(course.shortDescription)}
            </p>

            <div class="course-meta">

                <span>
                    <i class="fas fa-book"></i>
                    ${course.lessons} Lessons
                </span>

                <span>
                    <i class="fas fa-signal"></i>
                    ${escapeHTML(course.level)}
                </span>

            </div>

            <div class="course-bottom">

                <div class="course-rating">
                    <i class="fas fa-star"></i>
                    <span>
                        ${escapeHTML(course.rating)}
                    </span>
                </div>

                <strong class="course-price">
                    ${priceText}
                </strong>

            </div>

            <button
                class="course-open-btn"
                onclick="openCourse(${course.id})">

                ${isFree ? "Start Learning" : "View Course"}

                <i class="fas fa-arrow-right"></i>

            </button>

        </div>
    `;

    return card;
}

/* =========================================================
   DISPLAY FEATURED COURSES
========================================================= */

function displayFeaturedCourses() {
    const container =
        document.getElementById("featuredCourseContainer");

    if (!container) return;

    container.innerHTML = "";

    if (courses.length === 0) {
        container.innerHTML = `
            <p class="empty-courses">
                No courses available yet.
            </p>
        `;
        return;
    }

    courses.slice(0, 3).forEach(function (course) {
        container.appendChild(
            createCourseCard(course)
        );
    });
}

/* =========================================================
   DISPLAY ALL COURSES
========================================================= */

function displayCourses(courseList = courses) {
    const container =
        document.getElementById("courseContainer");

    const noCourses =
        document.getElementById("noCourses");

    if (!container) return;

    container.innerHTML = "";

    if (courseList.length === 0) {
        if (noCourses) {
            noCourses.style.display = "block";
        }
        return;
    }

    if (noCourses) {
        noCourses.style.display = "none";
    }

    courseList.forEach(function (course) {
        container.appendChild(
            createCourseCard(course)
        );
    });
}

/* =========================================================
   SEARCH
========================================================= */

function searchCourses() {
    const input =
        document.getElementById("courseSearch");

    if (!input) return;

    const searchTerm =
        input.value.trim().toLowerCase();

    const activeButton =
        document.querySelector(".filter-btn.active");

    const activeCategory =
        activeButton
            ? activeButton.textContent.trim()
            : "All";

    let filteredCourses = courses;

    if (activeCategory !== "All") {
        filteredCourses = filteredCourses.filter(function (course) {
            return (
                course.category || ""
            ).toLowerCase() === activeCategory.toLowerCase();
        });
    }

    if (searchTerm !== "") {
        filteredCourses = filteredCourses.filter(function (course) {
            const searchableText = `
                ${course.title}
                ${course.category}
                ${course.description}
                ${course.shortDescription}
                ${course.level}
            `.toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    displayCourses(filteredCourses);
}

function setupCourseSearch() {
    const input =
        document.getElementById("courseSearch");

    if (!input) return;

    input.addEventListener("input", searchCourses);
}

/* =========================================================
   FILTER
========================================================= */

function filterCourses(category, button) {
    document
        .querySelectorAll(".filter-btn")
        .forEach(function (btn) {
            btn.classList.remove("active");
        });

    if (button) {
        button.classList.add("active");
    }

    let filteredCourses = courses;

    if (category !== "all") {
        filteredCourses =
            filteredCourses.filter(function (course) {
                return (
                    course.category || ""
                ).toLowerCase() === category.toLowerCase();
            });
    }

    const searchInput =
        document.getElementById("courseSearch");

    const searchTerm =
        searchInput
            ? searchInput.value.trim().toLowerCase()
            : "";

    if (searchTerm !== "") {
        filteredCourses =
            filteredCourses.filter(function (course) {
                return `
                    ${course.title}
                    ${course.category}
                    ${course.description}
                    ${course.shortDescription}
                `.toLowerCase().includes(searchTerm);
            });
    }

    displayCourses(filteredCourses);
}

/* =========================================================
   OPEN COURSE
========================================================= */

async function openCourse(courseId) {
    currentCourse =
        courses.find(function (course) {
            return Number(course.id) === Number(courseId);
        });

    if (!currentCourse) {
        console.error("Course not found:", courseId);
        return;
    }

    const coursesPage =
        document.getElementById("coursesPage");

    const studyArea =
        document.getElementById("studyArea");

    if (coursesPage) {
        coursesPage.style.display = "none";
    }

    if (studyArea) {
        studyArea.style.display = "block";
    }

    document
        .querySelectorAll(".footer")
        .forEach(function (footer) {
            footer.style.display = "none";
        });

    updateStudyHeader(currentCourse);

    showLoadingLessonList();

    await loadCourseContent(currentCourse);

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================================================
   UPDATE STUDY HEADER
========================================================= */

function updateStudyHeader(course) {
    const category =
        document.getElementById("studyCategory");

    const title =
        document.getElementById("studyCourseTitle");

    const description =
        document.getElementById("studyCourseDescription");

    if (category) {
        category.textContent =
            course.category || "General";
    }

    if (title) {
        title.textContent =
            course.title || "Course";
    }

    if (description) {
        description.textContent =
            course.description || "";
    }
}

/* =========================================================
   LOADING
========================================================= */

function showLoadingLessonList() {
    const container =
        document.getElementById("moduleContainer");

    if (!container) return;

    container.innerHTML = `
        <div class="lesson-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Loading course content...</p>
        </div>
    `;
}

/* =========================================================
   LOAD COURSE CONTENT FROM DATABASE
========================================================= */

async function loadCourseContent(course) {
    allLessons = [];

    const container =
        document.getElementById("moduleContainer");

    try {
        const url =
            "/api/course-content?course=" +
            encodeURIComponent(course.title);

        console.log("Loading:", url);

        const response =
            await fetch(url, {
                method: "GET",
                credentials: "same-origin",
                cache: "no-cache"
            });

        if (!response.ok) {
            throw new Error(
                "Could not load course content."
            );
        }

        const data =
            await response.json();

        console.log("Course API:", data);

        if (!data.success) {
            throw new Error(
                data.message ||
                "Course content could not be loaded."
            );
        }

        const content =
            Array.isArray(data.content)
                ? data.content
                : [];

        buildLessonsFromDatabase(content);

        if (allLessons.length === 0) {
            if (container) {
                container.innerHTML = `
                    <div class="empty-lessons">
                        <i class="fas fa-book-open"></i>
                        <p>
                            No lessons have been added
                            to this course yet.
                        </p>
                    </div>
                `;
            }

            showWelcomeLesson();
            return;
        }

        buildLessonListFromDatabase();

        currentLessonIndex = 0;

        openLesson(0);

    } catch (error) {

        console.error(
            "Course content error:",
            error
        );

        if (container) {
            container.innerHTML = `
                <div class="empty-lessons">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>
                        ${escapeHTML(error.message)}
                    </p>
                </div>
            `;
        }

        showWelcomeLesson();
    }
}

/* =========================================================
   BUILD LESSONS FROM DATABASE
========================================================= */

function buildLessonsFromDatabase(content) {
    const lessonMap = new Map();

    content.forEach(function (item) {

        const lessonTitle =
            item.lesson_title ||
            item.title ||
            "Untitled Lesson";

        if (!lessonMap.has(lessonTitle)) {

            lessonMap.set(lessonTitle, {
                id: "lesson-" + item.id,
                title: lessonTitle,
                contents: [],
                video: null,
                notes: "",
                pdf: "",
                quiz: null,
                assignment: null
            });
        }

        const lesson =
            lessonMap.get(lessonTitle);

        const type =
            String(item.content_type || "")
                .trim()
                .toLowerCase();

        lesson.contents.push(item);

        /* VIDEO */

        if (
            type === "video" ||
            item.youtube_id ||
            item.youtube_url
        ) {
            lesson.video = item;
        }

        /* NOTES */

        if (
            type === "notes" ||
            type === "note"
        ) {
            if (item.content_text) {
                lesson.notes +=
                    (lesson.notes ? "\n\n" : "") +
                    item.content_text;
            }
        }

        /* PDF */

        if (
            type === "pdf" ||
            type === "document" ||
            type === "file"
        ) {
            lesson.pdf =
                item.external_url || "";
        }

        /* QUIZ */

        if (type === "quiz") {
            lesson.quiz = item;
        }

        /* ASSIGNMENT */

        if (
            type === "assessment" ||
            type === "assignment"
        ) {
            lesson.assignment = item;
        }
    });

    allLessons =
        Array.from(lessonMap.values());

    console.log(
        "Lessons created:",
        allLessons
    );
}

/* =========================================================
   BUILD LESSON SIDEBAR
========================================================= */

function buildLessonListFromDatabase() {
    const container =
        document.getElementById("moduleContainer");

    if (!container) return;

    container.innerHTML = "";

    const module =
        document.createElement("div");

    module.className =
        "study-module";

    module.innerHTML = `
        <div class="module-header">
            <h4>Course Lessons</h4>
        </div>

        <div class="lesson-list"></div>
    `;

    const lessonList =
        module.querySelector(".lesson-list");

    allLessons.forEach(function (lesson, index) {

        const button =
            document.createElement("button");

        button.className =
            "lesson-button";

        button.dataset.index =
            index;

        button.innerHTML = `
            <span class="lesson-icon">
                <i class="fas fa-play-circle"></i>
            </span>

            <span class="lesson-info">
                <strong>
                    ${escapeHTML(
                        cleanLessonTitle(
                            lesson.title
                        )
                    )}
                </strong>
            </span>
        `;

        button.addEventListener(
            "click",
            function () {
                openLesson(index);
            }
        );

        lessonList.appendChild(button);
    });

    container.appendChild(module);
}

/* =========================================================
   OPEN LESSON
========================================================= */

function openLesson(index) {

    if (
        index < 0 ||
        index >= allLessons.length
    ) {
        return;
    }

    currentLessonIndex = index;

    const lesson =
        allLessons[index];

    const welcome =
        document.getElementById("welcomeLesson");

    const viewer =
        document.getElementById("lessonViewer");

    const lessonNumber =
        document.getElementById("lessonNumber");

    const lessonTitle =
        document.getElementById("lessonTitle");

    const lessonNotes =
        document.getElementById("lessonNotes");

    if (welcome) {
        welcome.style.display = "none";
    }

    if (viewer) {
        viewer.style.display = "block";
    }

    if (lessonNumber) {
        lessonNumber.textContent =
            `Lesson ${index + 1}`;
    }

    if (lessonTitle) {
        lessonTitle.textContent =
            cleanLessonTitle(lesson.title);
    }

    if (lessonNotes) {
        lessonNotes.innerHTML =
            lesson.notes
                ? formatText(lesson.notes)
                : "No lesson notes have been added yet.";
    }

    renderLessonVideo(lesson);
    renderLessonMaterials(lesson);
    renderLessonQuiz(lesson);
    renderLessonAssignment(lesson);

    updateLessonNavigation();
    updateActiveLesson(index);
}

/* =========================================================
   WELCOME
========================================================= */

function showWelcomeLesson() {
    const welcome =
        document.getElementById("welcomeLesson");

    const viewer =
        document.getElementById("lessonViewer");

    if (welcome) {
        welcome.style.display = "block";
    }

    if (viewer) {
        viewer.style.display = "none";
    }
}
/* =========================================================
   RENDER VIDEO
========================================================= */

function renderLessonVideo(lesson) {

    const container = document.getElementById("lessonVideo");

    if (!container) return;

    const video = lesson.video;

    if (!video) {
        container.innerHTML = `
            <div>
                <i class="fas fa-video-slash"></i>
                <p>
                    No video is available for this lesson.
                </p>
            </div>
        `;
        return;
    }

    let youtubeId = video.youtube_id || "";

    if (!youtubeId && video.youtube_url) {
        youtubeId = extractYouTubeId(video.youtube_url);
    }

    youtubeId = String(youtubeId).trim();

    if (youtubeId) {

        container.innerHTML = `
            <iframe
                src="https://www.youtube.com/embed/${escapeAttribute(youtubeId)}"
                title="${escapeAttribute(
                    video.title || lesson.title || "Course Video"
                )}"
                frameborder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen>
            </iframe>
        `;

        return;
    }

    container.innerHTML = `
        <div>
            <i class="fas fa-video-slash"></i>
            <p>
                Video information is available,
                but no playable video was found.
            </p>
        </div>
    `;
}


/* =========================================================
   YOUTUBE ID
========================================================= */

function extractYouTubeId(url) {

    if (!url) return "";

    const text = String(url).trim();

    const patterns = [
        /youtube\.com\/watch\?v=([^&]+)/i,
        /youtube\.com\/embed\/([^?&]+)/i,
        /youtu\.be\/([^?&]+)/i,
        /youtube\.com\/shorts\/([^?&]+)/i
    ];

    for (const pattern of patterns) {

        const match = text.match(pattern);

        if (match && match[1]) {
            return match[1];
        }
    }

    return "";
}

/* =========================================================
   RENDER MATERIALS / PDF
========================================================= */

function renderLessonMaterials(lesson) {
    const container =
        document.getElementById("lessonMaterials");

    if (!container) return;

    container.innerHTML = "";

    const materials = [];

    lesson.contents.forEach(function (item) {

        const type =
            String(item.content_type || "")
                .trim()
                .toLowerCase();

        if (
            type === "pdf" ||
            type === "document" ||
            type === "file"
        ) {

            const url =
                item.external_url ||
                item.pdf_url ||
                "";

            if (url) {
                materials.push({
                    title:
                        item.title ||
                        "Course PDF",

                    url: url,

                    type: "pdf"
                });
            }
        }
    });

    if (materials.length === 0) {

        container.innerHTML = `
            <div class="material-empty">
                <i class="fas fa-folder-open"></i>
                <p>
                    No additional materials for this lesson.
                </p>
            </div>
        `;

        return;
    }

    materials.forEach(function (material) {

        const card =
            document.createElement("div");

        card.className =
            "material-card";

        card.innerHTML = `
            <div class="material-icon">
                <i class="fas fa-file-pdf"></i>
            </div>

            <div class="material-info">

                <h4>
                    ${escapeHTML(material.title)}
                </h4>

                <div class="material-actions">

                    <a
                        href="${escapeAttribute(material.url)}"
                        target="_blank"
                        rel="noopener noreferrer">

                        <i class="fas fa-eye"></i>
                        View

                    </a>

                    <a
                        href="${escapeAttribute(material.url)}"
                        download>

                        <i class="fas fa-download"></i>
                        Download

                    </a>

                </div>

            </div>
        `;

        container.appendChild(card);
    });
}

/* =========================================================
   RENDER QUIZ
========================================================= */

function renderLessonQuiz(lesson) {

    const container =
        document.getElementById("lessonQuiz");

    if (!container) return;

    if (!lesson.quiz) {
        container.innerHTML = "";
        container.style.display = "none";
        return;
    }

    const quizUrl =
        lesson.quiz.external_url || "";

    container.style.display =
        "block";

    if (!quizUrl) {

        container.innerHTML = `
            <div class="quiz-box">
                <h3>📝 Quiz</h3>
                <p>
                    Quiz link has not been added yet.
                </p>
            </div>
        `;

        return;
    }

    container.innerHTML = `
        <div class="quiz-box">

            <h3>
                📝 ${escapeHTML(
                    lesson.quiz.title ||
                    "Lesson Quiz"
                )}
            </h3>

            <p>
                Test your understanding of this lesson.
            </p>

            <a
                href="${escapeAttribute(quizUrl)}"
                target="_blank"
                rel="noopener noreferrer"
                class="quiz-button">

                Start Quiz

            </a>

        </div>
    `;
}

/* =========================================================
   RENDER ASSIGNMENT
========================================================= */

function renderLessonAssignment(lesson) {

    const assignment =
        document.getElementById("lessonAssignment");

    if (!assignment) return;

    if (!lesson.assignment) {
        assignment.style.display = "none";
        return;
    }

    assignment.style.display = "block";

    assignment.innerHTML = `
        <h3>
            <i class="fas fa-pen"></i>
            Assignment
        </h3>

        <p>
            An assignment is available for this lesson.
        </p>

        <button
            class="activity-btn"
            onclick="openAssignment(${currentLessonIndex})">

            View Assignment

        </button>
    `;
}

/* =========================================================
   ASSIGNMENT
========================================================= */

function openAssignment(index) {

    const lesson =
        allLessons[index];

    if (!lesson) return;

    alert(
        "Assignment system is ready to connect to the assignment database for this lesson."
    );
}

/* =========================================================
   ACTIVE LESSON
========================================================= */

function updateActiveLesson(index) {

    document
        .querySelectorAll(".lesson-button")
        .forEach(function (button) {
            button.classList.remove("active");
        });

    const active =
        document.querySelector(
            `.lesson-button[data-index="${index}"]`
        );

    if (active) {
        active.classList.add("active");
    }
}

/* =========================================================
   LESSON NAVIGATION
========================================================= */

function previousLesson() {

    if (currentLessonIndex <= 0) {
        return;
    }

    openLesson(
        currentLessonIndex - 1
    );
}

function nextLesson() {

    if (
        currentLessonIndex >=
        allLessons.length - 1
    ) {
        return;
    }

    openLesson(
        currentLessonIndex + 1
    );
}

function updateLessonNavigation() {

    const previous =
        document.getElementById("previousLesson");

    const next =
        document.getElementById("nextLesson");

    if (previous) {
        previous.disabled =
            currentLessonIndex === 0;
    }

    if (next) {
        next.disabled =
            currentLessonIndex ===
            allLessons.length - 1;
    }
}

/* =========================================================
   BACK TO COURSES
========================================================= */

function backToCourses() {

    const coursesPage =
        document.getElementById("coursesPage");

    const studyArea =
        document.getElementById("studyArea");

    if (studyArea) {
        studyArea.style.display = "none";
    }

    if (coursesPage) {
        coursesPage.style.display = "block";
    }

    document
        .querySelectorAll(".footer")
        .forEach(function (footer) {
            footer.style.display = "";
        });

    currentCourse = null;
    allLessons = [];
    currentLessonIndex = 0;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

/* =========================================================
   SCROLL
========================================================= */

function scrollToCourses() {

    const section =
        document.getElementById("allCourses");

    if (!section) return;

    section.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

/* =========================================================
   HERO SLIDER
========================================================= */

function showSlide(index) {

    const slides =
        document.querySelectorAll(
            ".courses-slider .slide"
        );

    const dots =
        document.querySelectorAll(
            ".courses-slider .dot"
        );

    if (!slides.length) return;

    if (index >= slides.length) {
        currentSlide = 0;
    } else if (index < 0) {
        currentSlide =
            slides.length - 1;
    } else {
        currentSlide = index;
    }

    slides.forEach(function (slide, i) {
        slide.classList.toggle(
            "active",
            i === currentSlide
        );
    });

    dots.forEach(function (dot, i) {
        dot.classList.toggle(
            "active",
            i === currentSlide
        );
    });
}

function nextSlide() {

    const slides =
        document.querySelectorAll(
            ".courses-slider .slide"
        );

    if (!slides.length) return;

    showSlide(currentSlide + 1);
    restartSlider();
}

function previousSlide() {

    const slides =
        document.querySelectorAll(
            ".courses-slider .slide"
        );

    if (!slides.length) return;

    showSlide(currentSlide - 1);
    restartSlider();
}

function startSlider() {

    const slides =
        document.querySelectorAll(
            ".courses-slider .slide"
        );

    if (slides.length <= 1) return;

    showSlide(0);

    sliderTimer =
        setInterval(function () {
            showSlide(currentSlide + 1);
        }, 6000);
}

function restartSlider() {

    if (sliderTimer) {
        clearInterval(sliderTimer);
    }

    startSlider();
}

/* =========================================================
   CLEAN LESSON TITLE
========================================================= */

function cleanLessonTitle(title) {

    if (!title) {
        return "Lesson";
    }

    return String(title)
        .replace(
            /^Lesson\s+\d+\s*[—-]\s*/i,
            ""
        )
        .trim();
}

/* =========================================================
   FORMAT TEXT
========================================================= */

function formatText(text) {

    if (!text) return "";

    return escapeHTML(
        String(text)
    ).replace(/\n/g, "<br>");
}

/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHTML(value);
}

/* =========================================================
   GLOBAL HELPERS
========================================================= */

function getCourseById(courseId) {

    return courses.find(function (course) {
        return Number(course.id) === Number(courseId);
    });
}

function getAllCourses() {
    return courses;
}

function getAllLessons() {
    return allLessons;
}