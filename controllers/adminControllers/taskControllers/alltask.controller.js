import { responseData } from "../../../utils/respounse.js";
import projectModel from "../../../models/adminModels/project.model.js";
import taskModel from "../../../models/adminModels/task.model.js";
import leadTaskModel from "../../../models/adminModels/leadTask.model.js";
import leadModel from "../../../models/adminModels/leadModel.js";
import { filterTasks } from "../../../utils/filterTasks.js"; 
import openTaskModel from "../../../models/adminModels/openTask.model.js";
import openTimerModel from "../../../models/adminModels/openTimer.model.js";
import { onlyAlphabetsValidation } from "../../../utils/validation.js";
import orgModel from "../../../models/orgmodels/org.model.js";
import registerModel from "../../../models/usersModels/register.model.js";
import { send_mail } from "../../../utils/mailtemplate.js";

function generateSixDigitNumber() {
    const min = 100000;
    const max = 999999;
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

    return randomNumber;
}

const createTaskAndTimer = async (res,req,org_id, check_user, task_assignee, task_name, task_description, /*estimated_task_start_date,*/ estimated_task_end_date, task_status, task_priority, reporter, actual_task_start_date, actual_task_end_date) => {
    const task_id = `TK-${generateSixDigitNumber()}`;

    const task = new openTaskModel({
        task_id,
        org_id,
        task_name,
        task_description,
        // estimated_task_start_date, // Commented out
        estimated_task_end_date,
        actual_task_start_date,
        actual_task_end_date,
        task_status,
        task_priority,
        task_assignee,
        task_createdBy: check_user.username,
        task_createdOn: new Date(),
        reporter,
        subtasks: []
    });

    const taskTime = new openTimerModel({
        task_id,
        org_id,
        task_name,
        task_assignee,
        task_time: '',
        subtaskstime: [],
        taskstime: []
    });

    await task.save();
    await taskTime.save();


    
    const updateTimer = await openTimerModel.findOneAndUpdate({ task_id: task_id, org_id:org_id }, {
        $push: {
            taskstime: {
                task_id, task_name, task_assignee, task_time: ''
            }
        }
    });

    if(!updateTimer) {
        return responseData(res, "Task timer not found", 404, false, "", []);
        
    }

    if(task_assignee !=='') {
    const findUser = await registerModel.findOne({ username: task_assignee, organization: org_id });
    const find_reporter = await registerModel.findOne({username:reporter, organization: org_id})
    await send_mail(findUser.email, task_assignee, task_name,"Open Type", estimated_task_end_date, task_priority, task_status, reporter,find_reporter.email, req.user.username, "Open Type");
    }
    responseData(res, "Task created successfully", 200, true, "", []);
};

export const Alltask = async (req, res) => {
    try {
        const { org_id, task_assignee, task_status, task_priority, user_id } = req.query;
        const user = req.user


        if (!org_id) {
            return responseData(res, "", 400, false, "org_id is required", []);
        }

        // console.log(user)

        if(user.role === 'SUPERADMIN' || user.role === 'ADMIN') {
            const [projectTasks, leadTasks, openTasks] = await Promise.all([
                taskModel.find({ org_id }),    
                leadTaskModel.find({ org_id }),
                openTaskModel.find({ org_id }) 
            ]);
            const [projects, leads] = await Promise.all([
                projectModel.find({ org_id, project_id: { $in: projectTasks.map(task => task.project_id) } }),
                leadModel.find({ org_id, lead_id: { $in: leadTasks.map(task => task.lead_id) } }),
            ]);
            const projectTaskDetails = projectTasks.map(task => {
                const project = projects.find(p => p.project_id === task.project_id);
                return {
                    project_id: task.project_id,
                    name: project ? project.project_name : "Unknown",
                    type: "project",
                    task_id: task.task_id,
                    org_id: task.org_id,
                    task_name: task.task_name,
                    task_status: task.task_status,
                    task_priority: task.task_priority,
                    task_assignee: task.task_assignee,
                    task_end_date: task.estimated_task_end_date,
                   
                };
            });
            const leadTaskDetails = leadTasks.map(task => {
                const lead = leads.find(l => l.lead_id === task.lead_id);
                return {
                    lead_id: task.lead_id,
                    name: lead ? lead.name : "Unknown",
                    type: "lead",
                    task_id: task.task_id,
                    org_id: task.org_id,
                    task_name: task.task_name,
                    task_status: task.task_status,
                    task_priority: task.task_priority,
                    task_assignee: task.task_assignee,
                    task_end_date: task.estimated_task_end_date,
                    
                };
            });
    
            const openTaskDetails = openTasks.map(task => ({
                name: "Unknown",
                type: "open",
                task_id: task.task_id,
                org_id: task.org_id,
                task_name: task.task_name,
                task_status: task.task_status,
                task_priority: task.task_priority,
                task_assignee: task.task_assignee,
                task_end_date: task.estimated_task_end_date,
                actual_task_start_date: task.actual_task_start_date,
                actual_task_end_date: task.actual_task_end_date,
            }));
    
            
            const allTasks = [...projectTaskDetails, ...leadTaskDetails, ...openTaskDetails];
            const filterConditions = {};
            if (task_assignee) filterConditions.task_assignee = task_assignee;
            if (task_status) filterConditions.task_status = task_status;
            if (task_priority) filterConditions.task_priority = task_priority;
            const filteredTasks = filterTasks(allTasks, filterConditions);
            return responseData(res, "All tasks fetched successfully", 200, true, "", filteredTasks);

        } else {
            const [projectTasks, leadTasks, openTasks] = await Promise.all([
                taskModel.find({ org_id }),    
                leadTaskModel.find({ org_id }),
                openTaskModel.find({ org_id }) 
            ]);
            const assignedProjectAndLead = await registerModel.find({ _id: user_id, organization: org_id });

            const userData = assignedProjectAndLead[0]?.data?.[0];
            const projectIds = Array.isArray(userData?.projectData) ? userData.projectData.map(p => p.project_id) : [];
            const leadIds = Array.isArray(userData?.leadData) ? userData.leadData.map(l => l.lead_id) : [];

            const [projects, leads] = await Promise.all([
                projectModel.find({ org_id, project_id: { $in: projectIds } }),
                leadModel.find({ org_id, lead_id: { $in: leadIds } }),
            ]);
            
            // console.log(assignedProjectAndLead)

            const projectTaskDetails = projectTasks.map(task => {
                const project = projects.find(p => p.project_id === task.project_id);
                return {
                    project_id: task.project_id,
                    name: project ? project.project_name : "Unknown",
                    type: "project",
                    task_id: task.task_id,
                    org_id: task.org_id,
                    task_name: task.task_name,
                    task_status: task.task_status,
                    task_priority: task.task_priority,
                    task_assignee: task.task_assignee,
                    task_end_date: task.estimated_task_end_date,
                };
            });

            const leadTaskDetails = leadTasks.map(task => {
                const lead = leads.find(l => l.lead_id === task.lead_id);
                return {
                    lead_id: task.lead_id,
                    name: lead ? lead.name : "Unknown",
                    type: "lead",
                    task_id: task.task_id,
                    org_id: task.org_id,
                    task_name: task.task_name,
                    task_status: task.task_status,
                    task_priority: task.task_priority,
                    task_assignee: task.task_assignee,
                    task_end_date: task.estimated_task_end_date,
S                };
            });

            const openTaskDetails = openTasks.map(task => ({
                name: "Unknown",
                type: "open",
                task_id: task.task_id,
                org_id: task.org_id,
                task_name: task.task_name,
                task_status: task.task_status,
                task_priority: task.task_priority,
                task_assignee: task.task_assignee,
                // task_start_date: task.estimated_task_start_date, // Commented out
                task_end_date: task.estimated_task_end_date,
                actual_task_start_date: task.actual_task_start_date,
                actual_task_end_date: task.actual_task_end_date,
            }));

            const allTasks = [...projectTaskDetails, ...leadTaskDetails, ...openTaskDetails];
            const filterConditions = {};
            if (task_assignee) filterConditions.task_assignee = task_assignee;
            if (task_status) filterConditions.task_status = task_status;
            if (task_priority) filterConditions.task_priority = task_priority;
            const filteredTasks = filterTasks(allTasks, filterConditions);
            return responseData(res, "All tasks fetched successfully", 200, true, "", filteredTasks);

        }

        

    } catch (error) {
        console.log(error);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};

export const createOpenTask = async (req, res) => {

    try {
        const user_id = req.body.user_id;
        const org_id = req.body.org_id;
        const task_name = req.body.task_name;
        const task_description = req.body.task_description;
        const estimated_task_end_date = req.body.estimated_task_end_date;
        // const estimated_task_start_date = req.body.estimated_task_start_date; // Commented out
        const actual_task_start_date = req.body.actual_task_start_date;
        const actual_task_end_date = req.body.actual_task_end_date;
        const task_status = req.body.task_status;
        const task_priority = req.body.task_priority;
        const task_assignee = req.body.task_assignee;
        const reporter = req.body.reporter;

        if (!user_id) return responseData(res, "", 404, false, "User Id required", []);
        if (!onlyAlphabetsValidation(task_name) || task_name.length < 3) {
            return responseData(res, "", 404, false, "Task Name should be alphabets and at least 3 characters long", []);
        }
        if (!task_priority) return responseData(res, "", 404, false, "Task priority required", []);
        if (!estimated_task_end_date) return responseData(res, "", 404, false, "Task end date required", []);
        // if (!estimated_task_start_date) return responseData(res, "", 404, false, "Task start date required", []); // Commented out
        if (!task_status) return responseData(res, "", 404, false, "Task status required", []);
        if (!org_id) return responseData(res, "", 400, false, "Org Id required");
        // Check if the user exists
        const check_org = await orgModel.findOne({ _id: org_id })
        if (!check_org) {
            return responseData(res, "", 404, false, "Org not found");
        }
        const check_user = await registerModel.findOne({ _id: user_id,organization: org_id });
        if (!check_user) return responseData(res, "", 404, false, "User not found", []);

        await createTaskAndTimer(
            res, req, org_id, check_user, task_assignee, task_name, task_description,
            /*estimated_task_start_date,*/ estimated_task_end_date, task_status, task_priority, reporter,
            actual_task_start_date, actual_task_end_date
        );
    } catch (err) {
        console.log(err);
        res.status(500).send({ error: 'Internal Server Error', details: err });
    }
}

export const getSingleOpenTask = async (req, res) => {
    try {
        const { user_id, task_id, org_id } = req.query;

        // Validate required parameters
        if (!user_id || !task_id || !org_id) {
            return responseData(res, "", 400, false, "User ID, and Task ID, Org ID are required", []);
        }

        // Aggregate to find user, project, and task
        const result = await openTaskModel.aggregate([
            {
                $match: {
                    task_id: task_id,
                    org_id: org_id
                },
            },
            {
                $lookup: {
                    from: "users", // Assuming the collection name for users
                    localField: "task_assignee",
                    foreignField: "_id",
                    as: "assignee_info",
                },
            },
            {
                $project: {
                    project_id: 1,
                    task_id: 1,
                    task_name: 1,
                    task_description: 1,
                    estimated_task_end_date: 1,
                    // estimated_task_start_date: { $ifNull: ["$estimated_task_start_date", null] }, // Commented out
                    actual_task_start_date: 1,
                    actual_task_end_date: 1,
                    task_status: 1,
                    task_priority: 1,
                    task_createdOn: 1,
                    reporter: 1,
                    task_assignee: 1,
                    task_createdBy: 1,
                    number_of_subtasks: { $size: "$subtasks" },
                    assignee_name: { $arrayElemAt: ["$assignee_info.name", 0] },
                },
            },
        ]);

        if (!result.length) {
            return responseData(res, "Task not found", 200, false, "", []);
        }

        responseData(res, "Task found successfully", 200, true, "", result);
    } catch (err) {
        console.error(err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};

export const updateOpenTask = async (req, res) => {

    try {
        const user_id = req.body.user_id;
        const org_id = req.body.org_id;
        const task_name = req.body.task_name;
        const task_description = req.body.task_description;
        const estimated_task_end_date = req.body.estimated_task_end_date;
        // const estimated_task_start_date = req.body.estimated_task_start_date; // Commented out
        const actual_task_start_date = req.body.actual_task_start_date;
        const actual_task_end_date = req.body.actual_task_end_date;
        const task_status = req.body.task_status;
        const task_priority = req.body.task_priority;
        const task_assignee = req.body.task_assignee;
        const reporter = req.body.reporter;
        const task_id = req.body.task_id;
        if (!user_id) {
            responseData(res, "", 404, false, "User Id required", [])
        }
        else if (!onlyAlphabetsValidation(task_name) || task_name.length < 3) {
            responseData(res, "", 404, false, "Task Name should be alphabets and at least 3 characters long", [])
        }
        else if (!task_id) {
            responseData(res, "", 404, false, "Task Id required", [])
        }
        else if (!task_priority) {
            responseData(res, "", 404, false, "task priority required", [])

        }
        else if (!estimated_task_end_date) {
            responseData(res, "", 404, false, "Task end date required", [])
        }
        // else if (!estimated_task_start_date) {
        //     responseData(res, "", 404, false, "Task start date required", [])
        // }
        else if (!task_status) {
            responseData(res, "", 404, false, "Task status required", [])
        }

        else if (!org_id) {
            return responseData(res, "", 400, false, "Organization Id is required");
        }
        else {
            const check_org = await orgModel.findOne({ _id: org_id })
            if (!check_org) {
                return responseData(res, "", 404, false, "Org not found");
            }
            const check_user = await registerModel.findOne({ _id: user_id, organization: org_id })
            if (!check_user) {
                responseData(res, "", 404, false, "User not found", [])
            }
            else {
                
                const check_task = await openTaskModel.findOne({ task_id: task_id, org_id: org_id })
                if (!check_task) {
                    responseData(res, "", 404, false, "Task not found 1", [])
                }
                else {
                    const previous_task_assignee = check_task.task_assignee;
                    let findUser;
                    if(task_assignee) {
                        findUser = await registerModel.findOne({ username: task_assignee, organization: org_id });

                        if (!findUser) {
                            return responseData(res, "", 404, false, "User not found");
                            
                        }
                    }
                    const update_task = await openTaskModel.findOneAndUpdate({ task_id: task_id, org_id: org_id },
                        {
                            $set: {
                                task_name: task_name,
                                task_description: task_description,
                                estimated_task_end_date: estimated_task_end_date,
                                // estimated_task_start_date: estimated_task_start_date, // Commented out
                                actual_task_start_date: actual_task_start_date,
                                actual_task_end_date: actual_task_end_date,
                                task_status: task_status,
                                task_priority: task_priority,
                                task_assignee: task_assignee,
                                reporter: reporter,
                            },
                            $push: {
                                task_updatedBy: {
                                    task_updatedBy: check_user.username,
                                    role: check_user.role,
                                    task_updatedOn: new Date()
                                }

                            }
                        },
                        { new: true, useFindAndModify: false }
                    )
                    if (update_task) {
                        if (task_assignee && previous_task_assignee != task_assignee) {
                            const find_reporter = await registerModel.findOne({organization:org_id, username:reporter})
                            await send_mail(findUser.email, task_assignee, task_name, "Open Type", estimated_task_end_date, task_priority, task_status, reporter, find_reporter.email,req.user.username, "Open Type");
                        }
                        responseData(res, "Task updated successfully", 200, true, "", [])
                    }
                    else {
                        responseData(res, "", 404, false, "Task not updated", [])
                    }
                }
                
            }
        }
    }
    catch (err) {
        console.log(err);
        res.send(err);
    }
}

export const deleteOpenTask = async (req, res) => {
    try {
        const user_id = req.body.user_id;
        const task_id = req.body.task_id;
        const org_id = req.body.org_id;

        if (!user_id) {
            responseData(res, "", 404, false, "User Id required", [])
        }
       

        else if (!task_id) {
            responseData(res, "", 404, false, "Task Id required", [])
        }
        else if (!org_id) {
            return responseData(res, "", 400, false, "Organization Id is required");
        }
        else {
            const check_org = await orgModel.findOne({ _id: org_id })
            if (!check_org) {
                return responseData(res, "", 404, false, "Org not found");
            }
            const check_user = await registerModel.findOne({ _id: user_id, organization: org_id });
            if (!check_user) {
                responseData(res, "", 404, false, "User not found", [])
            }
            else {
                const check_task = await openTaskModel.findOne({ task_id: task_id, org_id: org_id });
                if (!check_task) {
                    responseData(res, "", 404, false, "Task not found 2", [])
                }
                else {
                    const delete_task = await openTaskModel.findOneAndDelete({ task_id: task_id, org_id: org_id })
                    if (delete_task) {
                        responseData(res, "Task deleted successfully", 200, true, "", [])
                    }
                    else {
                        responseData(res, "", 404, false, "Task not deleted", [])
                    }
                }
                

            }
        }


    }
    catch (err) {
        console.log(err);
        res.send(err);

    }
}


export const MoveTask = async (req, res) => {
    try {
        const { user_id, task_id, org_id, project_id, lead_id } = req.body;

        // Validate input parameters
        if (!user_id || !task_id || !org_id) {
            return responseData(res, "", 400, false, "User Id, Task Id, and Organization Id are required", []);
        }

        // Check if Organization exists
        const check_org = await orgModel.findOne({ _id: org_id });
        if (!check_org) {
            return responseData(res, "", 404, false, "Organization not found", []);
        }

        // Check if User exists in the given organization
        const check_user = await registerModel.findOne({ _id: user_id, organization: org_id });
        if (!check_user) {
            return responseData(res, "", 404, false, "User not found", []);
        }

        // Check for task in all three models
        let check_task = null;
        let sourceModel = null;
        let sourceType = null;

        // Check in open tasks
        check_task = await openTaskModel.findOne({ task_id, org_id });
        if (check_task) {
            sourceModel = openTaskModel;
            sourceType = "open";
        }

        // Check in project tasks if not found
        if (!check_task) {
            check_task = await taskModel.findOne({ task_id, org_id });
            if (check_task) {
                sourceModel = taskModel;
                sourceType = "project";
            }
        }

        // Check in lead tasks if not found
        if (!check_task) {
            check_task = await leadTaskModel.findOne({ task_id, org_id });
            if (check_task) {
                sourceModel = leadTaskModel;
                sourceType = "lead";
            }
        }

        // If task not found in any model
        if (!check_task) {
            return responseData(res, "", 404, false, "Task not found in any category", []);
        }

        // Rest of your existing validation code for assignee and reporter...
        const checkAssignee = async (task, projectIdOrLeadId, type) => {
            const assigneeData = await registerModel.findOne({ username: task.task_assignee, status: true, organization: org_id });
            if (!assigneeData || !Array.isArray(assigneeData.data) || !assigneeData.data[0]) return null;

            const dataObj = assigneeData.data[0];
            const arr = type === "project" ? dataObj.projectData : dataObj.leadData;
            if (!Array.isArray(arr)) return null;

            return arr.find(item => item[type === "project" ? "project_id" : "lead_id"] === projectIdOrLeadId);
        };

        const checkReporter = async (task, projectIdOrLeadId, type) => {
            const assigneeData = await registerModel.findOne({ username: task.reporter, status: true, organization: org_id });
            if (!assigneeData || !Array.isArray(assigneeData.data) || !assigneeData.data[0]) return null;

            const dataObj = assigneeData.data[0];
            const arr = type === "project" ? dataObj.projectData : dataObj.leadData;
            if (!Array.isArray(arr)) return null;

            return arr.find(item => item[type === "project" ? "project_id" : "lead_id"] === projectIdOrLeadId);
        };

        // Your existing validation logic...

        // Create the new task in the appropriate model
        const taskData = {
            task_id: check_task.task_id,
            org_id: check_task.org_id,
            task_name: check_task.task_name,
            task_assignee: check_task.task_assignee,
            task_status: check_task.task_status,
            estimated_task_end_date: check_task.estimated_task_end_date,
            actual_task_start_date: check_task.actual_task_start_date,
            actual_task_end_date: check_task.actual_task_end_date,
            task_description: check_task.task_description,
            task_priority: check_task.task_priority,
            task_createdBy: check_task.task_createdBy,
            task_createdOn: check_task.task_createdOn,
            reporter: check_task.reporter,
            subtasks: check_task.subtasks
        };

        let newTask;
        if (project_id) {
            const check_project = await projectModel.findOne({ project_id, org_id });
            if (!check_project) {
                return responseData(res, "", 404, false, "Project not found", []);
            }

            newTask = new taskModel({ project_id, ...taskData });
        } else {
            const check_lead = await leadModel.findOne({ lead_id, org_id });
            if (!check_lead) {
                return responseData(res, "", 404, false, "Lead not found", []);
            }

            newTask = new leadTaskModel({ lead_id, ...taskData });
        }

        // Delete from the source model
        const deleteTask = await sourceModel.findOneAndDelete({ task_id, org_id });
        if (!deleteTask) {
            return responseData(res, "", 404, false, "Task not deleted from source", []);
        }

        const saveTask = await newTask.save();
        if (saveTask) {
            return responseData(res, "Task moved successfully", 200, true, "", []);
        }

        return responseData(res, "", 404, false, "Task not moved", []);
    } catch (err) {
        console.error(err);
        return responseData(res, "", 500, false, "Internal server error", []);
    }
};
