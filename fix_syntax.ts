
import fs from "fs";
const path = "./src/pages/MachineSchedule.tsx";
let content = fs.readFileSync(path, "utf8");

// The apply_dnd.ts script incorrectly duplicated the ending braces.
// Let us replace the very end of the file to be strictly correct.
const correctEnding = `
                                </select>
                            </div>

                            <div className="pt-4">
                                <button 
                                    onClick={handleAssignSubmit}
                                    disabled={!selectedOperatorId || isSubmitting}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                >
                                    {isSubmitting ? "Saving..." : "Confirm Assignment"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MachineSchedule;`;

const index = content.lastIndexOf("</select>");
if (index !== -1) {
    content = content.substring(0, index) + correctEnding;
    fs.writeFileSync(path, content);
    console.log("Syntax fixed");
} else {
    console.log("Could not find anchor");
}

