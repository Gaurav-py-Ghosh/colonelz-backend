import projectModel from "../../../models/adminModels/project.model.js";
import projectExecutionModel from "../../../models/adminModels/project_execution_model.js";
import orgModel from "../../../models/orgmodels/org.model.js";
import { responseData } from "../../../utils/respounse.js";


function generateSixDigitNumber() {
    const min = 100000;
    const max = 999999;
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

    return randomNumber;
}

export const createProjectExecutionSubtask = async (req, res) => {
    try {
        const { org_id, project_id, task_id, subtask_name, subtask_start_date, subtask_end_date, color } = req.body;
        if (!org_id) {
            return responseData(res, "", 400, false, "Org id is required", []);
        }
        else if (!project_id) {
            return responseData(res, "", 400, false, "Project id is required", []);
        }
        else if (!task_id) {
            return responseData(res, "", 400, false, "Task id is required", []);
        }
        else if (!subtask_name) {
            return responseData(res, "", 400, false, "Subtask name is required", []);
        }
        else if (!subtask_start_date) {
            return responseData(res, "", 400, false, "Subtask start date is required", []);
        }
        else if (!subtask_end_date) {
            return responseData(res, "", 400, false, "Subtask end date is required", []);
        }
        else {
            const subtask_id = `STK${generateSixDigitNumber()}`;
            const check_org = await orgModel.findOne({ _id: org_id });
            if (!check_org) {
                return responseData(res, "", 400, false, "Org not found", []);
            }
            const check_project = await projectModel.findOne({ project_id: project_id, org_id: org_id });
            if (!check_project) {
                return responseData(res, "", 400, false, "Project not found", []);
            }
            const check_task = await projectExecutionModel.findOne({ task_id: task_id, project_id: project_id, org_id: org_id });
            if (!check_task) {
                return responseData(res, "", 400, false, "Task not found", []);
            }
            const create_subtask = await projectExecutionModel.updateOne({ task_id: task_id, project_id: project_id, org_id: org_id }, { $push: { subtasks: { sub_task_id: subtask_id, sub_task_name: subtask_name, sub_task_start_date: subtask_start_date, sub_task_end_date: subtask_end_date, color: color } } });
            if (create_subtask) {
                return responseData(res, "Subtask created successfully", 200, true, "", []);
            }
            else {
                return responseData(res, "", 400, false, "Subtask not created", []);
            }
        }
    }
    catch (err) {
        console.log(err)
        responseData(res, "", 500, false, "Internal server error", []);
    }
}


function extendTaskEndDate(
    taskEndDateStr,
    subtaskStartDateStr,
    subtaskEndDateStr
) {
    const taskEndDate = new Date(taskEndDateStr);
    const subtaskStartDate = new Date(subtaskStartDateStr);
    const subtaskEndDate = new Date(subtaskEndDateStr);

    // Calculate the difference in days between subtask start and end
    const durationInMs = subtaskEndDate.getTime() - subtaskStartDate.getTime();
    const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));

    // Add the duration to the task end date
    const extendedEndDate = new Date(taskEndDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + durationInDays + 1);

    return extendedEndDate.toString(); // returns in the same format as input
}


export const updateProjectExecutionSubtask = async (req, res) => {
    try {
        const {
            org_id,
            project_id,
            task_id,
            subtask_id,
            subtask_name,
            subtask_start_date,
            subtask_end_date,
            color,

            reason,
            days_number,
            child_task_id,
            child_subtask_id,
            affection,


            subtask_details_start_date,
            subtask_details_end_date,
            subtask_comment,
            subtask_type,
            detail_color
        } = req.body;

        if (!org_id || !project_id || !task_id || !subtask_id || !subtask_start_date || !subtask_end_date) {
            return responseData(res, "", 400, false, "All required fields must be provided", []);
        }

        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) return responseData(res, "", 400, false, "Org not found", []);

        const check_project = await projectModel.findOne({ project_id, org_id });
        if (!check_project) return responseData(res, "", 400, false, "Project not found", []);

        const check_task = await projectExecutionModel.findOne({ task_id, project_id, org_id });
        if (!check_task) return responseData(res, "", 400, false, "Task not found", []);

        const find_subtask = check_task.subtasks.find((subtask) => subtask.sub_task_id === subtask_id);

        const updateObject = {
            $set: {
                'subtasks.$.sub_task_name': subtask_name,
                'subtasks.$.sub_task_start_date': subtask_start_date,
                'subtasks.$.sub_task_end_date': subtask_type === 'Delay' ? extendTaskEndDate(find_subtask.sub_task_end_date, subtask_details_start_date, subtask_details_end_date) : subtask_end_date,
                'subtasks.$.color': color
            }
        };
        const d_id = `DSTK-${generateSixDigitNumber()}`;
        if (subtask_details_start_date && subtask_details_end_date && subtask_comment && subtask_type) {
            updateObject.$push = {
                'subtasks.$.sub_task_details': {
                    subtask_details_id: d_id,
                    subtask_details_start_date,
                    subtask_details_end_date,
                    subtask_comment,
                    subtask_type,
                    color: detail_color
                }
            };
        }

        const updateSubtask = await projectExecutionModel.updateOne(
            {
                task_id,
                project_id,
                org_id,
                'subtasks.sub_task_id': subtask_id
            },
            updateObject
        );


        
        if (Array.isArray(affection) && affection.length > 0 && subtask_type === 'Delay') {

            // actual extension in task and subtask in child

            affection.map(async (aff) => {

                const updateChildObject = {
                };
                updateChildObject.$push = {
                    'subtasks.$.other_subtask_affects': {
                        par_task_id: task_id,
                        par_subtask_id: subtask_id,
                        par_subtask_details_id: d_id,
                        reason: aff.reason,
                        days_number: aff.days_number,
                    }
                };
    
                const updateSubtask = await projectExecutionModel.updateOne(
                    {
                        task_id: aff.task_id,
                        project_id,
                        org_id,
                        'subtasks.sub_task_id': aff.sub_task_id
                    },
                    updateChildObject
                );


            })

            
        }

        if (subtask_type === 'Delay') {

            const taskUpdateObject = {
                $set: {
                    'end_date': subtask_type === 'Delay' && extendTaskEndDate(check_task.end_date, subtask_details_start_date, subtask_details_end_date)
                }
            };

            const updateTask = await projectExecutionModel.updateOne(
                {
                    task_id,
                    project_id,
                    org_id,
                },
                taskUpdateObject
            );

        }


        if (updateSubtask.modifiedCount > 0) {
            return responseData(res, "Subtask updated successfully", 200, true, "", []);
        } else {
            return responseData(res, "", 400, false, "Subtask not updated", []);
        }

    } catch (err) {
        console.error("Error updating subtask:", err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};


export const deleteProjectExecutionSubtask = async (req, res) => {
    try {
        const { org_id, project_id, task_id, subtask_id } = req.body;

        if (!org_id || !project_id || !task_id || !subtask_id) {
            return responseData(res, "", 400, false, "All required fields must be provided", []);
        }
        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) return responseData(res, "", 400, false, "Org not found", []);

        const check_project = await projectModel.findOne({ project_id, org_id });
        if (!check_project) return responseData(res, "", 400, false, "Project not found", []);
        const check_task = await projectExecutionModel.findOne({ task_id, project_id, org_id });
        if (!check_task) return responseData(res, "", 400, false, "Task not found", []);

        const deleteSubtask = await projectExecutionModel.updateOne(
            { task_id, project_id, org_id },
            { $pull: { subtasks: { sub_task_id: subtask_id } } }
        );

        if (deleteSubtask.modifiedCount > 0) {

            return responseData(res, "Subtask deleted successfully", 200, true, "", []);
        }
        else {
            return responseData(res, "", 400, false, "Subtask not deleted", []);
        }

    } catch (err) {
        console.error("Error deleting subtask:", err);
        return responseData(res, "", 500, false, "Internal server error ", []);
    }
}

function shortTaskEndDate(
    taskEndDateStr,
    subtaskStartDateStr,
    subtaskEndDateStr
) {
    const taskEndDate = new Date(taskEndDateStr);
    const subtaskStartDate = new Date(subtaskStartDateStr);
    const subtaskEndDate = new Date(subtaskEndDateStr);

    // Calculate the difference in days between subtask start and end
    const durationInMs = subtaskEndDate.getTime() - subtaskStartDate.getTime();
    const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));

    // Add the duration to the task end date
    const extendedEndDate = new Date(taskEndDate);
    extendedEndDate.setDate(extendedEndDate.getDate() - durationInDays - 1);

    return extendedEndDate.toString(); // returns in the same format as input
}
export const deleteProjectExecutionSubtaskDetails = async (req, res) => {
    try {
        const { org_id, project_id, task_id, subtask_id, subtask_details_id } = req.body;

        if (!org_id || !project_id || !task_id || !subtask_id || !subtask_details_id) {

            return responseData(res, "", 400, false, "All required fields must be provided", []);
        }

        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) return responseData(res, "", 400, false, "Org not found", []);

        const check_project = await projectModel.findOne({ project_id, org_id });
        if (!check_project) return responseData(res, "", 400, false, "Project not found", []);

        const check_task = await projectExecutionModel.findOne({ task_id, project_id, org_id });
        if (!check_task) return responseData(res, "", 400, false, "Task not found", []);


        const find_subtask = check_task.subtasks.find((subtask) => subtask.sub_task_id === subtask_id);
        if (!find_subtask) {
            console.error("Subtask not found:", subtask_id);
            return responseData(res, "", 400, false, "Subtask not found", []);
        }

        const find_detail = find_subtask.sub_task_details.find((detail) => detail.subtask_details_id === subtask_details_id);
        if (!find_detail) {
            console.error("Subtask detail not found:", subtask_details_id);
            return responseData(res, "", 400, false, "Subtask detail not found", []);
        }


        if (find_detail.subtask_type === 'Delay') {

            const updateObject = {
                $set: {
                    'subtasks.$.sub_task_end_date': shortTaskEndDate(find_subtask.sub_task_end_date, find_detail.subtask_details_start_date, find_detail.subtask_details_end_date)
                }
            };
            const updateSubtask = await projectExecutionModel.updateOne(
                {
                    task_id,
                    project_id,
                    org_id,
                    'subtasks.sub_task_id': subtask_id
                },
                updateObject
            );



            const taskUpdateObject = {
                $set: {
                    'end_date':  shortTaskEndDate(check_task.end_date, find_detail.subtask_details_start_date, find_detail.subtask_details_end_date)
                }
            };

            const updateTask = await projectExecutionModel.updateOne(
                {
                    task_id,
                    project_id,
                    org_id,
                },
                taskUpdateObject
            );

        }




        const deleteSubtaskDetails = await projectExecutionModel.updateOne(
            { task_id, project_id, org_id, 'subtasks.sub_task_id': subtask_id },
            { $pull: { 'subtasks.$.sub_task_details': { subtask_details_id } } }
        );
        if (deleteSubtaskDetails.modifiedCount > 0) {
            return responseData(res, "Subtask details deleted successfully", 200, true, "", []);
        } else {
            return responseData(res, "", 400, false, "Subtask details not deleted", []);
        }

    } catch (err) {
        console.error("Error deleting subtask details:", err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
}

function compareDates(first, second) {
    const date1 = new Date(first);
    const date2 = new Date(second);

    if (date1 < date2) return -1;
    if (date1 > date2) return 1;
    return 0;
}

function extendTaskEndDateUpdate(
    taskEndDateStr,

    new_start,
    new_end,
    prev_start,
    prev_end,

) {
    const taskEndDate = new Date(taskEndDateStr);

    const prevStart = new Date(prev_start);
    const newStart = new Date(new_start);

    const prevEnd = new Date(prev_end);
    const newEnd = new Date(new_end);


    let extendedEndDate = new Date(taskEndDate);

    if (compareDates(prevStart, newStart) === -1) {
        const durationInMs = newStart.getTime() - prevStart.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        extendedEndDate.setDate(extendedEndDate.getDate() - (durationInDays));
        extendedEndDate = new Date(extendedEndDate.toString());

    } else if (compareDates(prevStart, newStart) === 1) {
        const durationInMs = prevStart.getTime() - newStart.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        extendedEndDate.setDate(extendedEndDate.getDate() + (durationInDays));
        extendedEndDate = new Date(extendedEndDate.toString());
    }

    if (compareDates(prevEnd, newEnd) === -1) {
        const durationInMs = newEnd.getTime() - prevEnd.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        extendedEndDate.setDate(extendedEndDate.getDate() + (durationInDays));
        extendedEndDate = new Date(extendedEndDate.toString());

    } else if (compareDates(prevEnd, newEnd) === 1) {
        const durationInMs = prevEnd.getTime() - newEnd.getTime();
        const durationInDays = Math.ceil(durationInMs / (1000 * 60 * 60 * 24));
        extendedEndDate.setDate(extendedEndDate.getDate() - (durationInDays));
        extendedEndDate = new Date(extendedEndDate.toString());

    }


    return extendedEndDate;
}


export const updateProjectExecutionSubtaskDetails = async (req, res) => {
    try {
        const {
            org_id,
            project_id,
            task_id,
            subtask_id,
            subtask_details_id,
            subtask_details_start_date,
            subtask_details_end_date,
            subtask_comment,
            subtask_type,
            detail_color,
        } = req.body;

        if (!org_id || !project_id || !task_id || !subtask_id || !subtask_details_id || !subtask_details_start_date || !subtask_details_end_date) {
            return responseData(res, "", 400, false, "All required fields must be provided", []);
        }

        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) return responseData(res, "", 400, false, "Org not found", []);

        const check_project = await projectModel.findOne({ project_id, org_id });
        if (!check_project) return responseData(res, "", 400, false, "Project not found", []);

        const check_task = await projectExecutionModel.findOne({ task_id, project_id, org_id });
        if (!check_task) return responseData(res, "", 400, false, "Task not found", []);

        // Update with arrayFilters to access nested sub_task_details
        const updateSubtaskDetails = await projectExecutionModel.updateOne(
            {
                task_id,
                project_id,
                org_id
            },
            {
                $set: {
                    'subtasks.$[subtask].sub_task_details.$[detail].subtask_details_start_date': subtask_details_start_date,
                    'subtasks.$[subtask].sub_task_details.$[detail].subtask_details_end_date': subtask_details_end_date,
                    'subtasks.$[subtask].sub_task_details.$[detail].subtask_comment': subtask_comment,
                    'subtasks.$[subtask].sub_task_details.$[detail].subtask_type': subtask_type,
                    'subtasks.$[subtask].sub_task_details.$[detail].color': detail_color
                }
            },
            {
                arrayFilters: [
                    { 'subtask.sub_task_id': subtask_id },
                    { 'detail.subtask_details_id': subtask_details_id }
                ]
            }
        );

        const find_subtask = check_task.subtasks.find((subtask) => subtask.sub_task_id === subtask_id);

        const find_detail = find_subtask.sub_task_details.find((detail) => detail.subtask_details_id === subtask_details_id);

        console.log("find_subtask:", find_subtask);
        console.log("find_detail:", find_detail);


        const updateObject = {
            $set: {
                'subtasks.$.sub_task_end_date': subtask_type === 'Delay'
    ? extendTaskEndDateUpdate(
        find_subtask.sub_task_end_date,
        subtask_details_start_date,
        subtask_details_end_date,
        find_detail.subtask_details_start_date,
        find_detail.subtask_details_end_date
    )
    : find_subtask.sub_task_end_date,
            }
        };
        const updateSubtask = await projectExecutionModel.updateOne(
            {
                task_id,
                project_id,
                org_id,
                'subtasks.sub_task_id': subtask_id
            },
            updateObject
        );

        if (subtask_type === 'Delay') {

            const taskUpdateObject = {
                $set: {
                    'end_date': subtask_type === 'Delay' && extendTaskEndDateUpdate(check_task.end_date, subtask_details_start_date, subtask_details_end_date, find_detail.subtask_details_start_date, find_detail.subtask_details_end_date)
                }
            };

            const updateTask = await projectExecutionModel.updateOne(
                {
                    task_id,
                    project_id,
                    org_id,
                },
                taskUpdateObject
            );

        }

        if (updateSubtaskDetails.modifiedCount > 0) {
            return responseData(res, "Subtask details updated successfully", 200, true, "", []);
        } else {
            return responseData(res, "", 400, false, "Subtask details not updated", []);
        }

    } catch (err) {
        console.error("Error updating subtask details:", err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};



const buildParDetails = (taskListFromDB, otherSubtaskAffects) => {
    const result = otherSubtaskAffects.map(affect => {
        const { par_task_id, par_subtask_id, par_subtask_details_id, reason, days_number } = affect

        const task = taskListFromDB.find(task => task.task_id === par_task_id)
        const subtask = task?.subtasks?.find(st => st.sub_task_id === par_subtask_id)
        const detail = subtask?.sub_task_details?.find(d => d.subtask_details_id === par_subtask_details_id)

        return {
            par_task_name: task?.task_name || 'Unknown Task',
            par_subtask_name: subtask?.sub_task_name || 'Unknown Subtask',
            detail_comment: detail?.subtask_comment || 'Unknown Detail',
            reason,
            days_number
        }
    })

    return result
}

export const getProjectExecutionSubtaskAffections = async (req, res) => {
    try {
        const {
            org_id,
            project_id,
            task_id,
            subtask_id,
        } = req.query;

        if (!org_id || !project_id || !task_id || !subtask_id) {
            return responseData(res, "", 400, false, "All required fields must be provided", []);
        }

        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) return responseData(res, "", 400, false, "Org not found", []);

        const check_project = await projectModel.findOne({ project_id, org_id });
        if (!check_project) return responseData(res, "", 400, false, "Project not found", []);

        const check_task = await projectExecutionModel.find({ project_id, org_id });
        if (!check_task) return responseData(res, "", 400, false, "Task not found", []);

        

        const find_task = check_task.find((task) => task.task_id === task_id);
        const find_subtask = find_task.subtasks.find((subtask) => subtask.sub_task_id === subtask_id);

        const resultObject = buildParDetails(check_task, find_subtask.other_subtask_affects);

        

        if (resultObject.length > 0) {
            return responseData(res, "Affections found successfully", 200, true, "", resultObject);
        } else {
            return responseData(res, "Affections not found", 404, true, "", []);

        }

    } catch (err) {
        console.error("Error getting affects:", err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};










