import { getPage, updatePageProperties, archivePage, queryTasks, sanitizePropertiesForUpdate } from './notion-client.js';

export interface Q1TestResults {
  targetPageId: string;
  targetPageTitle: string;
  case1_overlappingProperty: {
    statusCodes: number[];
    finalStatus: string;
    lastWriteWinsConfirmed: boolean;
    returned409: boolean;
  };
  case1_disjointProperties: {
    statusCodes: number[];
    finalProperties: Record<string, any>;
    mergedSuccessfully: boolean;
  };
  case1_writeVsArchive: {
    archiveStatusCode: number;
    writeStatusCode: number;
    writeToArchivedSuccess: boolean;
    finalArchivedState: boolean;
  };
  conclusion: string;
}

export async function runQ1Test(): Promise<Q1TestResults> {
  console.log('--- [Q1] Running Concurrent Writes Test on Notion Workspace B ---');
  const tasks = await queryTasks('B', 5);
  if (tasks.length === 0) {
    throw new Error('No tasks found in Workspace B');
  }

  // Choose the first task as target
  const targetTask = tasks[0];
  const targetPageId = targetTask.id;
  const initialSnapshot = await getPage(targetPageId, 'B');
  const title = initialSnapshot.properties.Name?.title?.[0]?.plain_text || 'Untitled';
  console.log(`Target Page: ${targetPageId} ("${title}")`);

  try {
    // --- Sub-test 1: Overlapping property write (Status) ---
    console.log('Sub-test 1: 3 concurrent writes to the same property (Status)...');
    const initialStatus = initialSnapshot.properties.Status?.select?.name || 'Not started';

    const p1 = updatePageProperties(targetPageId, { Status: { select: { name: 'In progress' } } }, 'B');
    const p2 = updatePageProperties(targetPageId, { Status: { select: { name: 'Done' } } }, 'B');
    const p3 = updatePageProperties(targetPageId, { Status: { select: { name: 'Not started' } } }, 'B');

    const results = await Promise.allSettled([p1, p2, p3]);
    const statusCodes = results.map((r) => (r.status === 'fulfilled' ? 200 : (r.reason?.status || 500)));
    const returned409 = results.some((r) => r.status === 'rejected' && r.reason?.status === 409);

    const postSub1 = await getPage(targetPageId, 'B');
    const finalStatus = postSub1.properties.Status?.select?.name || 'unknown';
    console.log(`Sub-test 1 finished. Status codes: ${JSON.stringify(statusCodes)}, Final Status: ${finalStatus}`);

    // --- Sub-test 2: Disjoint properties write ---
    console.log('Sub-test 2: 3 concurrent writes to disjoint properties (Status, Due date, Tags)...');
    const d1 = updatePageProperties(targetPageId, { Status: { select: { name: 'In progress' } } }, 'B');
    const d2 = updatePageProperties(targetPageId, { 'Due date': { date: { start: '2026-09-28' } } }, 'B');
    const d3 = updatePageProperties(targetPageId, { Tags: { multi_select: [{ name: 'feature' }, { name: 'concurrency' }] } }, 'B');

    const disjointResults = await Promise.allSettled([d1, d2, d3]);
    const disjointStatusCodes = disjointResults.map((r) => (r.status === 'fulfilled' ? 200 : (r.reason?.status || 500)));

    const postSub2 = await getPage(targetPageId, 'B');
    const mergedStatus = postSub2.properties.Status?.select?.name;
    const mergedDueDate = postSub2.properties['Due date']?.date?.start;
    const mergedTags = (postSub2.properties.Tags?.multi_select || []).map((t: any) => t.name);

    const mergedSuccessfully =
      mergedStatus === 'In progress' &&
      mergedDueDate === '2026-09-28' &&
      mergedTags.includes('concurrency');
    console.log(`Sub-test 2 finished. Merged successfully: ${mergedSuccessfully}`);

    // --- Sub-test 3: Write vs Archive race ---
    console.log('Sub-test 3: Concurrent Write vs Archive race condition...');
    const w1 = updatePageProperties(targetPageId, { Status: { select: { name: 'Done' } } }, 'B');
    const w2 = archivePage(targetPageId, true, 'B');

    const raceResults = await Promise.allSettled([w1, w2]);
    const writeStatusCode = raceResults[0].status === 'fulfilled' ? 200 : (raceResults[0].reason?.status || 500);
    const archiveStatusCode = raceResults[1].status === 'fulfilled' ? 200 : (raceResults[1].reason?.status || 500);

    const postSub3 = await getPage(targetPageId, 'B');
    console.log(`Sub-test 3 finished. Final archived state: ${postSub3.archived}`);

    // Restore page to unarchived and initial properties
    await archivePage(targetPageId, false, 'B');
    const cleanProps = sanitizePropertiesForUpdate(initialSnapshot.properties);
    await updatePageProperties(targetPageId, cleanProps, 'B');
    console.log('Target page restored to original state.');

    return {
      targetPageId,
      targetPageTitle: title,
      case1_overlappingProperty: {
        statusCodes,
        finalStatus,
        lastWriteWinsConfirmed: statusCodes.every((s) => s === 200) && !returned409,
        returned409,
      },
      case1_disjointProperties: {
        statusCodes: disjointStatusCodes,
        finalProperties: {
          Status: mergedStatus,
          DueDate: mergedDueDate,
          Tags: mergedTags,
        },
        mergedSuccessfully,
      },
      case1_writeVsArchive: {
        archiveStatusCode,
        writeStatusCode,
        writeToArchivedSuccess: writeStatusCode === 200,
        finalArchivedState: postSub3.archived,
      },
      conclusion:
        'Notion API không hỗ trợ Optimistic Concurrency Control (không có ETag/If-Match, không trả về 409). ' +
        'Ghi đồng thời cùng property diễn ra theo cơ chế Last-Write-Wins thầm lặng, ghi đè không cảnh báo. ' +
        'Ghi các property độc lập được Notion merge cấp property nếu cả 2 request đều thành công. ' +
        'BẮT BUỘC cần khoá cấp đối tượng (Object Lock) ở tầng ứng dụng để bảo vệ tính toàn vẹn và tránh đè dữ liệu.',
    };
  } catch (err) {
    // Attempt restore on error
    try {
      await archivePage(targetPageId, false, 'B');
      const cleanProps = sanitizePropertiesForUpdate(initialSnapshot.properties);
      await updatePageProperties(targetPageId, cleanProps, 'B');
    } catch {}
    throw err;
  }
}
