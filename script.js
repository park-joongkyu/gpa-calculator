const GRADE_SCALES = {
  "4.5": [
    ["A+", 4.5], ["A0", 4.0],
    ["B+", 3.5], ["B0", 3.0],
    ["C+", 2.5], ["C0", 2.0],
    ["D+", 1.5], ["D0", 1.0],
    ["F", 0.0],
    ["P", null],
  ],
  "4.3": [
    ["A+", 4.3], ["A0", 4.0], ["A-", 3.7],
    ["B+", 3.3], ["B0", 3.0], ["B-", 2.7],
    ["C+", 2.3], ["C0", 2.0], ["C-", 1.7],
    ["D+", 1.3], ["D0", 1.0], ["D-", 0.7],
    ["F", 0.0],
    ["P", null],
  ],
  "4.0": [
    ["A+", 4.0], ["A", 4.0], ["A-", 3.7],
    ["B+", 3.3], ["B", 3.0], ["B-", 2.7],
    ["C+", 2.3], ["C", 2.0], ["C-", 1.7],
    ["D+", 1.3], ["D", 1.0], ["D-", 0.7],
    ["F", 0.0],
    ["P", null],
  ],
};

const STORAGE_KEY = "gpa-calculator-state";

const courseBody = document.getElementById("course-body");
const scaleSelect = document.getElementById("scale-select");
const addRowBtn = document.getElementById("add-row-btn");
const resetBtn = document.getElementById("reset-btn");
const totalCreditsEl = document.getElementById("total-credits");
const gpaCreditsEl = document.getElementById("gpa-credits");
const gpaResultEl = document.getElementById("gpa-result");

let nextId = 1;

function createRow(course) {
  const tr = document.createElement("tr");
  tr.dataset.id = course.id;

  const nameTd = document.createElement("td");
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "과목명";
  nameInput.value = course.name;
  nameInput.addEventListener("input", () => {
    course.name = nameInput.value;
    persist();
  });
  nameTd.appendChild(nameInput);

  const creditTd = document.createElement("td");
  const creditInput = document.createElement("input");
  creditInput.type = "number";
  creditInput.min = "0";
  creditInput.step = "0.5";
  creditInput.placeholder = "학점";
  creditInput.value = course.credit;
  creditInput.addEventListener("input", () => {
    course.credit = creditInput.value;
    recalc();
  });
  creditTd.appendChild(creditInput);

  const gradeTd = document.createElement("td");
  const gradeSelect = document.createElement("select");
  gradeSelect.addEventListener("change", () => {
    course.grade = gradeSelect.value;
    recalc();
  });
  gradeTd.appendChild(gradeSelect);

  const removeTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    courses = courses.filter((c) => c.id !== course.id);
    tr.remove();
    recalc();
  });
  removeTd.appendChild(removeBtn);

  tr.appendChild(nameTd);
  tr.appendChild(creditTd);
  tr.appendChild(gradeTd);
  tr.appendChild(removeTd);

  tr._gradeSelect = gradeSelect;
  return tr;
}

function fillGradeOptions(tr, course) {
  const gradeSelect = tr._gradeSelect;
  const grades = GRADE_SCALES[scaleSelect.value];
  const previous = course.grade;
  gradeSelect.innerHTML = "";
  grades.forEach(([label]) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    gradeSelect.appendChild(option);
  });
  const stillValid = grades.some(([label]) => label === previous);
  gradeSelect.value = stillValid ? previous : grades[0][0];
  course.grade = gradeSelect.value;
}

let courses = [];

function addCourse(data) {
  const course = {
    id: nextId++,
    name: data?.name ?? "",
    credit: data?.credit ?? "3",
    grade: data?.grade ?? GRADE_SCALES[scaleSelect.value][0][0],
  };
  courses.push(course);
  const tr = createRow(course);
  courseBody.appendChild(tr);
  fillGradeOptions(tr, course);
  return course;
}

function refreshAllGradeOptions() {
  [...courseBody.children].forEach((tr) => {
    const course = courses.find((c) => String(c.id) === tr.dataset.id);
    if (course) fillGradeOptions(tr, course);
  });
}

function recalc() {
  const grades = GRADE_SCALES[scaleSelect.value];
  const pointMap = Object.fromEntries(grades.map(([label, point]) => [label, point]));

  let totalCredits = 0;
  let gpaCredits = 0;
  let totalPoints = 0;

  courses.forEach((course) => {
    const credit = parseFloat(course.credit);
    if (!Number.isFinite(credit) || credit <= 0) return;
    totalCredits += credit;

    const point = pointMap[course.grade];
    if (point === null || point === undefined) return; // P or unknown: excluded from GPA
    gpaCredits += credit;
    totalPoints += credit * point;
  });

  totalCreditsEl.textContent = formatNumber(totalCredits);
  gpaCreditsEl.textContent = formatNumber(gpaCredits);
  gpaResultEl.textContent = gpaCredits > 0 ? (totalPoints / gpaCredits).toFixed(2) : "0.00";

  persist();
}

function formatNumber(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function persist() {
  const state = {
    scale: scaleSelect.value,
    courses: courses.map(({ name, credit, grade }) => ({ name, credit, grade })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    addCourse();
    addCourse();
    addCourse();
    return;
  }
  try {
    const state = JSON.parse(raw);
    if (state.scale && GRADE_SCALES[state.scale]) {
      scaleSelect.value = state.scale;
    }
    if (Array.isArray(state.courses) && state.courses.length > 0) {
      state.courses.forEach((c) => addCourse(c));
    } else {
      addCourse();
      addCourse();
      addCourse();
    }
  } catch {
    addCourse();
    addCourse();
    addCourse();
  }
}

scaleSelect.addEventListener("change", () => {
  refreshAllGradeOptions();
  recalc();
});

addRowBtn.addEventListener("click", () => {
  addCourse();
  recalc();
});

resetBtn.addEventListener("click", () => {
  if (!confirm("입력한 과목을 모두 지울까요?")) return;
  courses = [];
  courseBody.innerHTML = "";
  addCourse();
  addCourse();
  addCourse();
  recalc();
});

loadState();
recalc();
