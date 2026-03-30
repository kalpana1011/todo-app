import "./style.css";

const todoForm = document.querySelector("form");
const todoInput = document.getElementById("todo-input");
const todoListUL = document.getElementById("todo-list");           // active todos
const completedListUL = document.getElementById("completed-list"); // completed todos
const divider = document.getElementById("divider");

let allTodos = getTodos();

let draggedId = null;
let draggedWasCompleted = null;

const uid = () => crypto.randomUUID();

window.addEventListener("load", () => {
  updateAllList();
  updateDividerVisibility();
});

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  addTodo();
});

// ===== add =====
function addTodo() {
  const todoText = (todoInput.value || "").trim();
  if (!todoText) return;

  const todoObject = {
    id: uid(),
    text: todoText,
    completed: false,
  };

  allTodos.push(todoObject);
  saveTodos();
  todoInput.value = "";
  updateAllList();
}

// ===== render =====
function updateAllList() {
  const active = allTodos.filter((t) => !t.completed);
  const done = allTodos.filter((t) => t.completed);

  updateTodoList(active, todoListUL, false);
  updateTodoList(done, completedListUL, true);
  updateDividerVisibility();
}

function updateDividerVisibility() {
  divider.style.display = allTodos.some((t) => t.completed) ? "block" : "none";
}

function updateTodoList(listItems, ulElement, isCompletedList) {
  ulElement.innerHTML = "";
  const updatedList = listItems.forEach((todo, index) => {
    const li = createTodoItem(todo, `${todo.id}-${index}`);
    ulElement.appendChild(li);
    return todo;
  });

  // enable DnD on this UL
  wireListDnD(ulElement, isCompletedList);
}

function createTodoItem(todo, todoId) {
  const liElement = document.createElement("li");
  liElement.className = "todo";
  liElement.dataset.id = todo.id;
  liElement.draggable = true;

  liElement.innerHTML = `
    <input type="checkbox" id="${todoId}">
    <label class="custom-checkbox" for="${todoId}">
      <svg fill="transparent" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>
    </label>
    <label for="${todoId}" class="todo-text"></label>
    <button class="delete-button" aria-label="Delete">
      <svg fill="var(--secondary-color)" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>
    </button>
  `;

  liElement.querySelector(".todo-text").textContent = todo.text;

  // delete
  liElement.querySelector(".delete-button").addEventListener("click", () => {
    allTodos = allTodos.filter((t) => t.id !== todo.id);
    saveTodos();
    updateAllList();
  });

  // checkbox toggle
  const checkbox = liElement.querySelector("input");
  checkbox.checked = todo.completed;
  checkbox.addEventListener("change", () => {
    const it = allTodos.find((t) => t.id === todo.id);
    if (it) it.completed = checkbox.checked;
    saveTodos();
    updateAllList();
  });

  // drag
  liElement.addEventListener("dragstart", (ev) => {
    draggedId = todo.id;
    draggedWasCompleted = todo.completed;
    liElement.classList.add("dragging");
    if (ev.dataTransfer) {
      ev.dataTransfer.setData("text/plain", draggedId);
      ev.dataTransfer.effectAllowed = "move";
    }
  });

  liElement.addEventListener("dragend", () => {
    liElement.classList.remove("dragging");
    draggedId = null;
    draggedWasCompleted = null;
  });

  return liElement;
}


// ===== storage =====
function saveTodos() {
  localStorage.setItem("todos", JSON.stringify(allTodos));
}

function getTodos() {
  const raw = localStorage.getItem("todos");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // migrate older entries that had no id
    return parsed.map((t) =>
      t && t.id ? t : { id: uid(), text: t?.text ?? "", completed: !!t?.completed }
    );
  } catch {
    return [];
  }
}

// ===== DnD: list wiring =====
function wireListDnD(ul, isCompletedList) {
  ul.addEventListener("dragover", (e) => {
    if (!draggedId) return;

    e.preventDefault(); // keep DnD alive

    const draggingEl = document.querySelector(".todo.dragging");
    const sameList = draggedWasCompleted === isCompletedList;

    // we always show a drop target highlight
    ul.classList.add("drop-target");

    // live reordering only within the same list
    if (draggingEl && sameList) {
      const after = getDragAfterElement(ul, e.clientY);
      if (after == null) ul.appendChild(draggingEl);
      else ul.insertBefore(draggingEl, after);
    }
  });

  ul.addEventListener("dragleave", () => {
    ul.classList.remove("drop-target");
  });

  ul.addEventListener("drop", (e) => {
    ul.classList.remove("drop-target");
    if (!draggedId) return;

    const targetCompleted = isCompletedList;
    const crossList = draggedWasCompleted !== targetCompleted;

    if (crossList) {
        // 1) flip completed flag
        const item = allTodos.find((t) => t.id === draggedId);
        if (item) item.completed = targetCompleted;

        // 2) build order for TARGET list at the drop position,
        //    but first REMOVE any existing draggedId from the DOM order
        const after = getDragAfterElement(ul, e.clientY);

        // read current ids from target UL and strip draggedId if the browser already moved it
        const idsNow = [...ul.querySelectorAll(".todo")].map((li) => li.dataset.id);
        const ids = idsNow.filter((id) => id !== draggedId); // <-- dedupe

        // compute insertion index
        let insertIndex = ids.length;
        if (after) {
            const afterIdx = ids.indexOf(after.dataset.id);
            insertIndex = afterIdx >= 0 ? afterIdx : ids.length;
        }

        // insert draggedId exactly once
        const orderedIds = [...ids];
        orderedIds.splice(insertIndex, 0, draggedId);

        // 3) persist
        persistOrderFromIds(orderedIds, targetCompleted);
        saveTodos();
        updateAllList();
        return;
    }


    // Same-list reorder: read order from DOM and persist
    const orderedIds = [...ul.querySelectorAll(".todo")].map((li) => li.dataset.id);
    persistOrderFromIds(orderedIds, targetCompleted);
    saveTodos();
    updateAllList();
  });
}

// Compute the element after which the dragged item should be inserted
function getDragAfterElement(container, y) {
  const els = [...container.querySelectorAll(".todo:not(.dragging)")];
  return els.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - (box.top + box.height / 2);
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }
      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

// Persist ordering of a list using an explicit list of ids for that side
function persistOrderFromIds(orderedIds, completedFlag) {
  const inThisList = allTodos.filter((t) => t.completed === completedFlag);
  const otherList = allTodos.filter((t) => t.completed !== completedFlag);

  const map = new Map(inThisList.map((t) => [t.id, t]));
  const seen = new Set();

  // build reordered side (unique ids only)
  const reordered = [];
  for (const id of orderedIds) {
    if (!seen.has(id) && map.has(id)) {
      reordered.push(map.get(id));
      seen.add(id);
    }
  }

  // append any items from this list that weren't in orderedIds (safety)
  for (const t of inThisList) {
    if (!seen.has(t.id)) reordered.push(t);
  }

  allTodos = completedFlag ? [...otherList, ...reordered] : [...reordered, ...otherList];
}

