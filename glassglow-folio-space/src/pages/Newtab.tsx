import React from "react";
import { ProjectKanbanBoard } from "@myop/Project-Kanban-Board";

const Newtab = () => {
  return (
    <ProjectKanbanBoard
      data={{
        columns: [
          {
            id: "backlog",
            title: "Backlog",
            collapsed: false,
            cards: [
              {
                id: "p1",
                title: "Critical security patch",
                description: "Fix XSS vulnerability in forms",
                priority: "critical",
                assignee: "Security Team",
                assigneeInitials: "ST",
                dueDate: "2025-02-01",
                subtasks: [],
                comments: [],
                activity: [],
              },
            ],
          },
          {
            id: "inprogress",
            title: "In Progress",
            collapsed: false,
            cards: [
              {
                id: "p2",
                title: "High priority feature",
                description: "Implement payment gateway",
                priority: "high",
                assignee: "Backend Team",
                assigneeInitials: "BT",
                dueDate: "2025-02-10",
                subtasks: [],
                comments: [],
                activity: [],
              },
            ],
          },
          {
            id: "review",
            title: "Review",
            collapsed: false,
            cards: [
              {
                id: "p3",
                title: "Medium priority update",
                description: "Update user dashboard UI",
                priority: "medium",
                assignee: "Frontend Team",
                assigneeInitials: "FT",
                dueDate: "2025-02-15",
                subtasks: [],
                comments: [],
                activity: [],
              },
            ],
          },
          {
            id: "done",
            title: "Done",
            collapsed: false,
            cards: [
              {
                id: "p4",
                title: "Low priority cleanup",
                description: "Remove deprecated code",
                priority: "low",
                assignee: "Dev Team",
                assigneeInitials: "DT",
                dueDate: "2025-01-20",
                subtasks: [],
                comments: [],
                activity: [],
              },
            ],
          },
        ],
        users: [
          {
            name: "Security Team",
            initials: "ST",
          },
          {
            name: "Backend Team",
            initials: "BT",
          },
          {
            name: "Frontend Team",
            initials: "FT",
          },
          {
            name: "Dev Team",
            initials: "DT",
          },
        ],
      }}
      style={{
        height: "90vh",
        width: "80vw",
        margin: "0 auto",
        marginTop: "5vh",
        borderRadius: "8px",
      }}
    />
  );
};

export default Newtab;
