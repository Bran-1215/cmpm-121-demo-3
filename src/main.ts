const button = document.createElement("button");
button.textContent = "Button";

button.addEventListener("click", () => {
  alert("You clicked the button!");
});

document.body.appendChild(button);
