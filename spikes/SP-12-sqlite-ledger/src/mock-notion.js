const fs = require('node:fs');
const path = require('node:path');

class MockNotionService {
  constructor(stateFilePath) {
    this.stateFilePath = stateFilePath || path.join(__dirname, '../evidence/mock-notion-state.json');
    this._ensureStateFile();
  }

  _ensureStateFile() {
    const dir = path.dirname(this.stateFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.stateFilePath)) {
      this.reset();
    }
  }

  reset(initialData = null) {
    const defaultData = initialData || {
      pages: {
        'page_task_101': {
          id: 'page_task_101',
          object: 'page',
          created_time: '2026-09-11T10:00:00.000Z',
          last_edited_time: '2026-09-11T10:00:00.000Z',
          archived: false,
          properties: {
            Title: { id: 'title', type: 'title', title: [{ type: 'text', text: { content: 'Implement Q3 Fail-Closed Design' } }] },
            Status: { id: 'status', type: 'status', status: { name: 'To Do', color: 'gray' } },
            Priority: { id: 'priority', type: 'select', select: { name: 'P0', color: 'red' } },
            Assignee: { id: 'assignee', type: 'people', people: [{ id: 'user_01', name: 'Product Owner' }] }
          }
        }
      },
      callHistory: []
    };
    fs.writeFileSync(this.stateFilePath, JSON.stringify(defaultData, null, 2), 'utf8');
  }

  _readState() {
    this._ensureStateFile();
    return JSON.parse(fs.readFileSync(this.stateFilePath, 'utf8'));
  }

  _writeState(state) {
    fs.writeFileSync(this.stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  }

  getPage(pageId) {
    const state = this._readState();
    const page = state.pages[pageId];
    if (!page) {
      throw new Error(`Notion 404: Page ${pageId} not found`);
    }
    return JSON.parse(JSON.stringify(page));
  }

  updatePage(pageId, properties) {
    const state = this._readState();
    const page = state.pages[pageId];
    if (!page) {
      throw new Error(`Notion 404: Page ${pageId} not found`);
    }

    // Merge properties
    for (const [key, val] of Object.entries(properties)) {
      page.properties[key] = val;
    }
    page.last_edited_time = new Date().toISOString();

    state.callHistory.push({
      method: 'updatePage',
      pageId,
      properties,
      timestamp: new Date().toISOString()
    });

    this._writeState(state);
    return JSON.parse(JSON.stringify(page));
  }

  getCallHistory() {
    const state = this._readState();
    return state.callHistory || [];
  }
}

module.exports = {
  MockNotionService
};
