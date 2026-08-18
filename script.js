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

const CATEGORIES = ["전공", "교양", "기타"];
const STORAGE_KEY = "gpa-calculator-state-v2";

const scaleSelect = document.getElementById("scale-select");
const semesterList = document.getElementById("semester-list");
const addSemesterBtn = document.getElementById("add-semester-btn");
const resetBtn = document.getElementById("reset-btn");

const totalCreditsEl = document.getElementById("total-credits");
const gpaResultEl = document.getElementById("gpa-result");
const majorGpaResultEl = document.getElementById("major-gpa-result");
const percentResultEl = document.getElementById("percent-result");

const targetGpaInput = document.getElementById("target-gpa");
const remainingCreditsInput = document.getElementById("remaining-credits");
const targetResultEl = document.getElementById("target-result");

let nextId = 1;
let semesters = [];

function pointMapFor(scale) {
  return Object.fromEntries(GRADE_SCALES[scale].map(([label, point]) => [label, point]));
}

function formatNumber(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

// ---------- course row ----------

function createCourseRow(course) {
  const tr = document.createElement("tr");
  tr.dataset.courseId = course.id;
  tr.className = course.excluded ? "excluded" : "";

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
    recalcAll();
  });
  creditTd.appendChild(creditInput);

  const categoryTd = document.createElement("td");
  const categorySelect = document.createElement("select");
  CATEGORIES.forEach((cat) => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });
  categorySelect.value = course.category;
  categorySelect.addEventListener("change", () => {
    course.category = categorySelect.value;
    recalcAll();
  });
  categoryTd.appendChild(categorySelect);

  const gradeTd = document.createElement("td");
  const gradeSelect = document.createElement("select");
  gradeSelect.addEventListener("change", () => {
    course.grade = gradeSelect.value;
    recalcAll();
  });
  gradeTd.appendChild(gradeSelect);

  const excludeTd = document.createElement("td");
  excludeTd.className = "col-exclude";
  const excludeCheckbox = document.createElement("input");
  excludeCheckbox.type = "checkbox";
  excludeCheckbox.className = "exclude-checkbox";
  excludeCheckbox.title = "재수강 이전 학점 등, 평점·학점 계산에서 완전히 제외";
  excludeCheckbox.checked = !!course.excluded;
  excludeCheckbox.addEventListener("change", () => {
    course.excluded = excludeCheckbox.checked;
    tr.classList.toggle("excluded", course.excluded);
    recalcAll();
  });
  excludeTd.appendChild(excludeCheckbox);

  const removeTd = document.createElement("td");
  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-row-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    course._semester.courses = course._semester.courses.filter((c) => c.id !== course.id);
    tr.remove();
    recalcAll();
  });
  removeTd.appendChild(removeBtn);

  tr.appendChild(nameTd);
  tr.appendChild(creditTd);
  tr.appendChild(categoryTd);
  tr.appendChild(gradeTd);
  tr.appendChild(excludeTd);
  tr.appendChild(removeTd);

  tr._gradeSelect = gradeSelect;
  fillGradeOptions(tr, course);
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

// ---------- semester ----------

function addCourseToSemester(semester, data) {
  const course = {
    id: nextId++,
    name: data?.name ?? "",
    credit: data?.credit ?? "3",
    category: CATEGORIES.includes(data?.category) ? data.category : "전공",
    grade: data?.grade ?? GRADE_SCALES[scaleSelect.value][0][0],
    excluded: !!data?.excluded,
    _semester: semester,
  };
  semester.courses.push(course);
  const tr = createCourseRow(course);
  semester._tbody.appendChild(tr);
  return course;
}

function createSemesterCard(semester) {
  const card = document.createElement("div");
  card.className = "semester-card";
  card.dataset.semesterId = semester.id;

  const header = document.createElement("div");
  header.className = "semester-header";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "semester-name-input";
  nameInput.value = semester.name;
  nameInput.addEventListener("input", () => {
    semester.name = nameInput.value;
    persist();
  });

  const stats = document.createElement("span");
  stats.className = "semester-stats";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "remove-semester-btn";
  removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", () => {
    if (semesters.length <= 1) {
      alert("최소 한 개의 학기는 남아있어야 해요.");
      return;
    }
    if (!confirm(`"${semester.name}" 학기를 삭제할까요? 안의 과목이 모두 지워져요.`)) return;
    semesters = semesters.filter((s) => s.id !== semester.id);
    card.remove();
    recalcAll();
  });

  header.appendChild(nameInput);
  header.appendChild(stats);
  header.appendChild(removeBtn);

  const table = document.createElement("table");
  table.className = "course-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>과목명</th>
        <th class="col-credit">학점</th>
        <th class="col-category">구분</th>
        <th class="col-grade">등급</th>
        <th class="col-exclude">제외</th>
        <th class="col-remove"></th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const addRowBtn = document.createElement("button");
  addRowBtn.type = "button";
  addRowBtn.className = "add-row-btn";
  addRowBtn.textContent = "+ 과목 추가";
  addRowBtn.addEventListener("click", () => {
    addCourseToSemester(semester, {});
    recalcAll();
  });

  card.appendChild(header);
  card.appendChild(table);
  card.appendChild(addRowBtn);

  semester._cardEl = card;
  semester._tbody = tbody;
  semester._statsEl = stats;

  return card;
}

function addSemester(data) {
  const semester = {
    id: nextId++,
    name: data?.name ?? `학기 ${semesters.length + 1}`,
    courses: [],
  };
  semesters.push(semester);
  const card = createSemesterCard(semester);
  semesterList.appendChild(card);

  const courseData = Array.isArray(data?.courses) && data.courses.length > 0
    ? data.courses
    : [{}, {}, {}];
  courseData.forEach((c) => addCourseToSemester(semester, c));

  return semester;
}

function refreshAllGradeOptions() {
  semesters.forEach((semester) => {
    semester.courses.forEach((course) => {
      const tr = semester._tbody.querySelector(`tr[data-course-id="${course.id}"]`);
      if (tr) fillGradeOptions(tr, course);
    });
  });
}

// ---------- calculation ----------

function courseContribution(course, pointMap) {
  if (course.excluded) return null;
  const credit = parseFloat(course.credit);
  if (!Number.isFinite(credit) || credit <= 0) return null;
  const point = pointMap[course.grade];
  return { credit, point: point === undefined ? null : point, category: course.category };
}

function recalcAll() {
  const scaleMax = parseFloat(scaleSelect.value);
  const pointMap = pointMapFor(scaleSelect.value);

  let totalCredits = 0;
  let gpaCredits = 0;
  let totalPoints = 0;
  let majorGpaCredits = 0;
  let majorTotalPoints = 0;

  semesters.forEach((semester) => {
    let sCredits = 0;
    let sGpaCredits = 0;
    let sPoints = 0;

    semester.courses.forEach((course) => {
      const contrib = courseContribution(course, pointMap);
      if (!contrib) return;

      sCredits += contrib.credit;
      totalCredits += contrib.credit;

      if (contrib.point !== null) {
        sGpaCredits += contrib.credit;
        sPoints += contrib.credit * contrib.point;
        gpaCredits += contrib.credit;
        totalPoints += contrib.credit * contrib.point;

        if (contrib.category === "전공") {
          majorGpaCredits += contrib.credit;
          majorTotalPoints += contrib.credit * contrib.point;
        }
      }
    });

    const sGpa = sGpaCredits > 0 ? sPoints / sGpaCredits : 0;
    semester._statsEl.innerHTML = `학점 <strong>${formatNumber(sCredits)}</strong> · 평점 <strong>${sGpa.toFixed(2)}</strong>`;
  });

  const gpa = gpaCredits > 0 ? totalPoints / gpaCredits : 0;
  const majorGpa = majorGpaCredits > 0 ? majorTotalPoints / majorGpaCredits : 0;

  totalCreditsEl.textContent = formatNumber(totalCredits);
  gpaResultEl.textContent = gpa.toFixed(2);
  majorGpaResultEl.textContent = majorGpa.toFixed(2);
  percentResultEl.textContent = scaleMax > 0 ? ((gpa / scaleMax) * 100).toFixed(1) : "0.0";

  updateTargetResult(gpaCredits, totalPoints, scaleMax);
  persist();
}

function updateTargetResult(gpaCredits, totalPoints, scaleMax) {
  targetResultEl.classList.remove("warn", "danger");

  const targetRaw = targetGpaInput.value;
  const remainingRaw = remainingCreditsInput.value;

  if (targetRaw === "" || remainingRaw === "") {
    targetResultEl.textContent = "과목을 입력하고 목표 평점과 남은 학점을 채워주세요.";
    return;
  }

  const target = parseFloat(targetRaw);
  const remaining = parseFloat(remainingRaw);

  if (!Number.isFinite(target) || !Number.isFinite(remaining) || remaining <= 0) {
    targetResultEl.textContent = "남은 학점을 0보다 크게 입력해주세요.";
    return;
  }

  const requiredAvg = (target * (gpaCredits + remaining) - totalPoints) / remaining;

  if (requiredAvg <= 0) {
    targetResultEl.innerHTML = `이미 목표 평점 <strong>${target.toFixed(2)}</strong>을 넘었어요. 남은 ${formatNumber(remaining)}학점은 낙제만 피하면 돼요.`;
  } else if (requiredAvg > scaleMax) {
    targetResultEl.classList.add("danger");
    targetResultEl.innerHTML = `이 등급 체계(최대 ${scaleMax})에서는 남은 ${formatNumber(remaining)}학점만으로 도달할 수 없어요. 필요 평균 <strong>${requiredAvg.toFixed(2)}</strong>`;
  } else {
    if (requiredAvg >= scaleMax - 0.5) targetResultEl.classList.add("warn");
    targetResultEl.innerHTML = `남은 ${formatNumber(remaining)}학점에서 평균 <strong>${requiredAvg.toFixed(2)}</strong>점 이상 받으면 목표 평점 ${target.toFixed(2)}을 달성해요.`;
  }
}

// ---------- persistence ----------

function persist() {
  const state = {
    scale: scaleSelect.value,
    targetGpa: targetGpaInput.value,
    remainingCredits: remainingCreditsInput.value,
    semesters: semesters.map((s) => ({
      name: s.name,
      courses: s.courses.map(({ name, credit, category, grade, excluded }) => ({
        name, credit, category, grade, excluded,
      })),
    })),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    addSemester({});
    return;
  }
  try {
    const state = JSON.parse(raw);
    if (state.scale && GRADE_SCALES[state.scale]) {
      scaleSelect.value = state.scale;
    }
    if (typeof state.targetGpa === "string") targetGpaInput.value = state.targetGpa;
    if (typeof state.remainingCredits === "string") remainingCreditsInput.value = state.remainingCredits;

    if (Array.isArray(state.semesters) && state.semesters.length > 0) {
      state.semesters.forEach((s) => addSemester(s));
    } else {
      addSemester({});
    }
  } catch {
    addSemester({});
  }
}

// ---------- events ----------

scaleSelect.addEventListener("change", () => {
  refreshAllGradeOptions();
  recalcAll();
});

addSemesterBtn.addEventListener("click", () => {
  addSemester({});
  recalcAll();
});

targetGpaInput.addEventListener("input", () => recalcAll());
remainingCreditsInput.addEventListener("input", () => recalcAll());

resetBtn.addEventListener("click", () => {
  if (!confirm("입력한 모든 학기와 과목을 지울까요?")) return;
  semesters = [];
  semesterList.innerHTML = "";
  targetGpaInput.value = "";
  remainingCreditsInput.value = "";
  addSemester({});
  recalcAll();
});

loadState();
recalcAll();
