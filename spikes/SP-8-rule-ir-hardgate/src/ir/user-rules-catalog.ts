import type { RuleIR } from "./types.js";

export const HR_PORTAL_DB_ID = "db-hr-portal-uuid-001";
export const TEAM_DB_ID = "db-team-uuid-002";
export const ROADMAP_PAGE_ID = "page-q3-roadmap-uuid-003";

export const WRITE_TOOLS = [
  "create_page",
  "update_page_properties",
  "archive_page",
  "delete_block",
  "update_database",
  "update_page_permissions",
];

export const USER_RULES_CATALOG: RuleIR[] = [
  {
    id: "R-01",
    name: "R-01: Xoá gì cũng phải hỏi trước",
    description: "Chặn mọi thao tác archive_page hoặc delete_block",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "tool",
      tool_name: ["archive_page", "delete_block"],
    },
  },
  {
    id: "R-02",
    name: "R-02: Đụng đến deadline là phải báo",
    description: "Chặn mọi cập nhật làm thay đổi trường Due date",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_page_properties",
        },
        {
          kind: "property",
          changed_properties: {
            contains: "Due date",
          },
        },
      ],
    },
  },
  {
    id: "R-03",
    name: "R-03: Đừng đụng vào database HR portal",
    description: "Chặn mọi thao tác ghi tác động lên database HR portal",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "target_scope",
          database_id: HR_PORTAL_DB_ID,
        },
      ],
    },
  },
  {
    id: "R-04",
    name: "R-04: Ngoài giờ làm việc và cuối tuần không tự ý sửa",
    description: "Chặn thao tác ghi ngoài khung 08:00-18:00 hoặc vào cuối tuần",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "or",
          predicates: [
            {
              kind: "temporal",
              time_window: {
                not_between: ["08:00", "18:00"],
              },
            },
            {
              kind: "temporal",
              days_of_week: {
                in: ["Saturday", "Sunday"],
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: "R-05",
    name: "R-05: Status update thoải mái trừ khi mark Done",
    description: "Chặn cập nhật chuyển Status sang Done",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_page_properties",
        },
        {
          kind: "property",
          property_transition: {
            property: "Status",
            to: "Done",
          },
        },
      ],
    },
  },
  {
    id: "R-06",
    name: "R-06: Cấm tạo task vào team database",
    description: "Chặn tạo trang mới vào DB team",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "create_page",
        },
        {
          kind: "target_scope",
          database_id: TEAM_DB_ID,
        },
      ],
    },
  },
  {
    id: "R-08",
    name: "R-08: Task của Linh thì đừng đụng vào",
    description: "Chặn thao tác ghi lên task do Linh tạo hoặc gán cho Linh",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "or",
          predicates: [
            {
              kind: "ownership",
              assignee: { contains: "Linh" },
            },
            {
              kind: "ownership",
              created_by: { in: ["Linh", "user_linh"] },
            },
          ],
        },
      ],
    },
  },
  {
    id: "R-10",
    name: "R-10: Never touch the Q3 roadmap page and its children",
    description: "Chặn mọi thao tác ghi lên roadmap page và toàn bộ con cháu của nó",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "or",
          predicates: [
            {
              kind: "target_scope",
              page_id: ROADMAP_PAGE_ID,
            },
            {
              kind: "target_scope",
              ancestor_ids: { contains: ROADMAP_PAGE_ID },
            },
          ],
        },
      ],
    },
  },
  {
    id: "R-11",
    name: "R-11: Đừng tự ý đổi assignee của người khác",
    description: "Chặn đổi Assignee sang người khác ngoài current_user",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_page_properties",
        },
        {
          kind: "property",
          changed_properties: {
            contains: "Assignee",
          },
        },
        {
          kind: "ownership",
          assignee: {
            not_equal_to_current_user: true,
          },
        },
      ],
    },
  },
  {
    id: "R-12",
    name: "R-12: Task không phải tao hoặc bot tạo thì đừng sửa",
    description: "Chặn sửa/xoá task không do current_user hoặc app_bot tạo",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: ["update_page_properties", "archive_page", "delete_block"],
        },
        {
          kind: "ownership",
          created_by: {
            not_in: ["current_user", "app_bot"],
          },
        },
      ],
    },
  },
  {
    id: "R-13",
    name: "R-13: Task do PM tạo chỉ cho sửa Status",
    description: "Chặn sửa các thuộc tính ngoài Status trên task do PM tạo",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "ownership",
          created_by: {
            in: ["Linh", "Tuan", "user_linh", "user_tuan", "PM"],
          },
        },
        {
          kind: "or",
          predicates: [
            {
              kind: "not",
              predicate: {
                kind: "tool",
                tool_name: "update_page_properties",
              },
            },
            {
              kind: "property",
              changed_properties: {
                not_empty_after_excluding: ["Status"],
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: "R-15",
    name: "R-15: Ngưỡng sửa/ghi cộng dồn trong job > 5",
    description: "Chặn thao tác ghi thứ 6 trở đi trong cùng một job",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: WRITE_TOOLS,
        },
        {
          kind: "threshold",
          metric: "job_cumulative_writes",
          operator: "gt",
          value: 5,
        },
      ],
    },
  },
  {
    id: "R-16",
    name: "R-16: Đổi deadline quá 3 task trong job",
    description: "Chặn thao tác đổi deadline từ task thứ 4 trở đi",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_page_properties",
        },
        {
          kind: "property",
          changed_properties: {
            contains: "Due date",
          },
        },
        {
          kind: "threshold",
          metric: "job_deadline_changes",
          operator: "gt",
          value: 3,
        },
      ],
    },
  },
  {
    id: "R-17",
    name: "R-17: Giới hạn tạo tối đa 10 task mỗi ngày",
    description: "Chặn tạo task thứ 11 trở đi trong ngày lịch",
    action: "APPROVAL",
    priority: 100,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "create_page",
        },
        {
          kind: "threshold",
          metric: "calendar_day_creates",
          operator: "gte",
          value: 10,
        },
      ],
    },
  },
  {
    id: "STATIC-IRREVERSIBLE",
    name: "Static: Thao tác irreversible luôn cần phê duyệt",
    description: "Tự động chặn mọi thao tác gắn cờ is_irreversible (FR-AP-05)",
    action: "APPROVAL",
    priority: 90,
    predicate: {
      kind: "irreversible",
      is_irreversible: true,
    },
  },
  {
    id: "STATIC-PERMISSIONS",
    name: "Static: Thay đổi quyền và chia sẻ cần phê duyệt",
    description: "Tự động chặn thay đổi quyền hoặc chia sẻ",
    action: "APPROVAL",
    priority: 90,
    predicate: {
      kind: "permission",
      changes_permission: true,
    },
  },
  {
    id: "STATIC-SCHEMA-DELETION",
    name: "Static: Xoá thuộc tính trong database schema",
    description: "Chặn xoá property khỏi database (A-09, A-16)",
    action: "APPROVAL",
    priority: 95,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_database",
        },
        {
          kind: "property",
          remove_property: true,
        },
      ],
    },
  },
  {
    id: "STATIC-DESTRUCTIVE-UPDATE",
    name: "Static: Chặn đổi status hoặc title mang tính ẩn/vô hiệu hoá/xoá trên thực tế",
    description: "Chặn hành vi dùng update_page_properties để xoá lén task hoặc đổi title thành rác (A-15)",
    action: "APPROVAL",
    priority: 95,
    predicate: {
      kind: "and",
      predicates: [
        {
          kind: "tool",
          tool_name: "update_page_properties",
        },
        {
          kind: "or",
          predicates: [
            {
              kind: "property",
              property_transition: {
                property: "Status",
                to_in: ["Deleted", "Deleted (bỏ)", "Archived", "Bỏ"],
              },
            },
            {
              kind: "property",
              property_transition: {
                property: "Title",
                to_matches: "(?:^zzz|ignore|trash|deleted|bỏ)",
              },
            },
          ],
        },
      ],
    },
  },
];
