import type {
  ToolPredicate,
  TargetScopePredicate,
  PropertyPredicate,
  OwnershipPredicate,
  ThresholdPredicate,
  TemporalPredicate,
  IrreversiblePredicate,
  PermissionPredicate,
} from "../ir/types.js";
import type { ToolCallContext, SessionContext } from "./context.js";

export function evaluateToolPredicate(
  pred: ToolPredicate,
  call: ToolCallContext
): boolean {
  if (pred.tool_name !== undefined) {
    const allowedTools = Array.isArray(pred.tool_name)
      ? pred.tool_name
      : [pred.tool_name];
    if (!allowedTools.includes(call.toolName)) {
      return false;
    }
  }

  if (pred.connector !== undefined) {
    const allowedConnectors = Array.isArray(pred.connector)
      ? pred.connector
      : [pred.connector];
    if (!allowedConnectors.includes(call.connector)) {
      return false;
    }
  }

  return true;
}

export function evaluateTargetScopePredicate(
  pred: TargetScopePredicate,
  call: ToolCallContext
): boolean {
  const target = call.target || {};
  const params = call.params || {};

  const effectiveDatabaseId =
    target.databaseId || params.database_id || (target.targetType === "database" ? target.id : undefined);
  const effectivePageId =
    target.pageId || params.page_id || (target.targetType === "page" ? target.id : undefined);
  const ancestorIds = target.ancestorIds || [];

  if (pred.target_type !== undefined) {
    if (target.targetType !== pred.target_type) {
      return false;
    }
  }

  if (pred.database_id !== undefined) {
    if (!effectiveDatabaseId) return false;
    if (typeof pred.database_id === "string") {
      if (effectiveDatabaseId !== pred.database_id) return false;
    } else if ("in" in pred.database_id && Array.isArray(pred.database_id.in)) {
      if (!pred.database_id.in.includes(effectiveDatabaseId)) return false;
    } else if ("eq" in pred.database_id && typeof pred.database_id.eq === "string") {
      if (effectiveDatabaseId !== pred.database_id.eq) return false;
    }
  }

  if (pred.page_id !== undefined) {
    if (!effectivePageId) return false;
    if (typeof pred.page_id === "string") {
      if (effectivePageId !== pred.page_id) return false;
    } else if ("in" in pred.page_id && Array.isArray(pred.page_id.in)) {
      if (!pred.page_id.in.includes(effectivePageId)) return false;
    } else if ("eq" in pred.page_id && typeof pred.page_id.eq === "string") {
      if (effectivePageId !== pred.page_id.eq) return false;
    }
  }

  if (pred.ancestor_ids !== undefined) {
    if (pred.ancestor_ids.contains) {
      if (!ancestorIds.includes(pred.ancestor_ids.contains)) return false;
    }
    if (pred.ancestor_ids.contains_any) {
      const match = pred.ancestor_ids.contains_any.some((id) => ancestorIds.includes(id));
      if (!match) return false;
    }
  }

  return true;
}

function normalizePropName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, "");
}

function extractPropertyValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === "object") {
    if (val.name !== undefined) return val.name;
    if (val.status?.name !== undefined) return val.status.name;
    if (val.select?.name !== undefined) return val.select.name;
  }
  return val;
}

export function evaluatePropertyPredicate(
  pred: PropertyPredicate,
  call: ToolCallContext
): boolean {
  const params = call.params || {};
  const properties = params.properties || {};
  const changedPropKeys = Object.keys(properties);

  if (pred.changed_properties !== undefined) {
    const cp = pred.changed_properties;
    if (cp.contains) {
      const normTarget = normalizePropName(cp.contains);
      const has = changedPropKeys.some((k) => normalizePropName(k) === normTarget);
      if (!has) return false;
    }
    if (cp.contains_any) {
      const normTargets = cp.contains_any.map(normalizePropName);
      const match = changedPropKeys.some((k) => normTargets.includes(normalizePropName(k)));
      if (!match) return false;
    }
    if (cp.not_empty_after_excluding) {
      const normExcludes = cp.not_empty_after_excluding.map(normalizePropName);
      const remaining = changedPropKeys.filter(
        (k) => !normExcludes.includes(normalizePropName(k))
      );
      if (remaining.length === 0) return false;
    }
  }

  if (pred.property_transition !== undefined) {
    const pt = pred.property_transition;
    const normTargetProp = normalizePropName(pt.property);

    // Look for matching property key in properties (handling camelCase / spaces)
    let rawVal: any = undefined;
    for (const key of changedPropKeys) {
      if (normalizePropName(key) === normTargetProp) {
        rawVal = properties[key];
        break;
      }
    }

    // Also check direct param like update_database{archived: true}
    if (rawVal === undefined) {
      for (const key of Object.keys(params)) {
        if (normalizePropName(key) === normTargetProp) {
          rawVal = params[key];
          break;
        }
      }
    }

    if (rawVal === undefined) return false;

    const targetPropVal = extractPropertyValue(rawVal);

    if (pt.to !== undefined) {
      if (targetPropVal !== pt.to) return false;
    }
    if (pt.to_in !== undefined) {
      if (!pt.to_in.includes(targetPropVal)) return false;
    }
    if (pt.to_not_in !== undefined) {
      if (pt.to_not_in.includes(targetPropVal)) return false;
    }
    if (pt.to_matches !== undefined) {
      const regex = new RegExp(pt.to_matches, "i");
      if (!regex.test(String(targetPropVal))) return false;
    }
  }

  if (pred.remove_property !== undefined) {
    const removeProp = params.remove_property || params.delete_property;
    if (!removeProp) return false;

    if (typeof pred.remove_property === "string") {
      if (removeProp !== pred.remove_property) return false;
    } else if (typeof pred.remove_property === "object" && "in" in pred.remove_property) {
      if (!pred.remove_property.in.includes(removeProp)) return false;
    }
  }

  return true;
}

export function evaluateOwnershipPredicate(
  pred: OwnershipPredicate,
  call: ToolCallContext,
  session: SessionContext
): boolean {
  const target = call.target || {};
  const params = call.params || {};

  // Check created_by (immutable attribute)
  if (pred.created_by !== undefined) {
    const createdBy = target.createdBy || "unknown";
    if (pred.created_by.in) {
      if (!pred.created_by.in.includes(createdBy)) return false;
    }
    if (pred.created_by.not_in) {
      // "current_user" maps to session.currentUser, "app_bot" is also trusted user
      const normalizedNotIn = pred.created_by.not_in.map((u) =>
        u === "current_user" ? session.currentUser : u
      );
      if (normalizedNotIn.includes(createdBy)) {
        return false;
      }
    }
  }

  // Check assignee
  if (pred.assignee !== undefined) {
    const props = params.properties || {};
    const newAssignee = props.Assignee || props.assignee || target.currentAssignee || [];
    const assigneeList: string[] = Array.isArray(newAssignee)
      ? newAssignee
      : typeof newAssignee === "string"
      ? [newAssignee]
      : [];

    if (pred.assignee.contains) {
      const has = assigneeList.some((a) =>
        a.toLowerCase().includes(pred.assignee!.contains!.toLowerCase())
      );
      if (!has) return false;
    }
    if (pred.assignee.not_contains) {
      const has = assigneeList.some((a) =>
        a.toLowerCase().includes(pred.assignee!.not_contains!.toLowerCase())
      );
      if (has) return false;
    }
    if (pred.assignee.not_equal_to_current_user) {
      // Check if new assignee is anyone other than current_user
      const isOnlyCurrentUser =
        assigneeList.length === 1 && assigneeList[0] === session.currentUser;
      if (isOnlyCurrentUser) return false;
    }
  }

  return true;
}

export function evaluateThresholdPredicate(
  pred: ThresholdPredicate,
  session: SessionContext
): boolean {
  let count = 0;
  switch (pred.metric) {
    case "job_cumulative_writes":
      // +1 to account for current candidate write operation
      count = session.cumulativeWritesInJob + 1;
      break;
    case "job_deadline_changes":
      count = session.deadlineChangesInJob + 1;
      break;
    case "job_distinct_pages":
      count = session.distinctPagesModifiedInJob.size + 1;
      break;
    case "calendar_day_creates":
      count = session.dailyTaskCreates + 1;
      break;
  }

  switch (pred.operator) {
    case "gt":
      return count > pred.value;
    case "gte":
      return count >= pred.value;
    case "eq":
      return count === pred.value;
  }
}

export function evaluateTemporalPredicate(
  pred: TemporalPredicate,
  session: SessionContext
): boolean {
  const date = session.now;
  const timeZone = session.timezone || "Asia/Ho_Chi_Minh";

  if (pred.time_window?.not_between) {
    const [startStr, endStr] = pred.time_window.not_between;
    const [startH, startM] = startStr.split(":").map(Number);
    const [endH, endM] = endStr.split(":").map(Number);

    // Format hours and minutes in target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const curH = Number(parts.find((p) => p.type === "hour")?.value || 0);
    const curM = Number(parts.find((p) => p.type === "minute")?.value || 0);

    const curMinutes = curH * 60 + curM;
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    const inRange = curMinutes >= startMinutes && curMinutes < endMinutes;
    if (inRange) {
      return false;
    }
  }

  if (pred.days_of_week?.in) {
    const dayFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
    });
    const dayName = dayFormatter.format(date);
    if (!pred.days_of_week.in.includes(dayName as any)) {
      return false;
    }
  }

  return true;
}

export function evaluateIrreversiblePredicate(
  pred: IrreversiblePredicate,
  call: ToolCallContext
): boolean {
  if (pred.is_irreversible) {
    return Boolean(call.isIrreversible);
  }
  return true;
}

export function evaluatePermissionPredicate(
  pred: PermissionPredicate,
  call: ToolCallContext
): boolean {
  if (pred.changes_permission) {
    return Boolean(call.changesPermission);
  }
  return true;
}
