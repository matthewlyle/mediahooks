if (!document.querySelector(".bg-floor")) {
  const floor = document.createElement("div");
  floor.className = "bg-floor";
  floor.setAttribute("aria-hidden", "true");
  const grid = document.createElement("div");
  grid.className = "bg-floor-grid";
  floor.append(grid);
  document.body.prepend(floor);
}
