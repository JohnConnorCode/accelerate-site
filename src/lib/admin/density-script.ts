/** Runs before paint; blocked storage simply uses the comfortable default. */
export const adminDensityScript = `try{document.documentElement.dataset.adminDensity=localStorage.getItem(${JSON.stringify("accelerate:admin:density:v1")})==='compact'?'compact':'comfortable'}catch{}`;
