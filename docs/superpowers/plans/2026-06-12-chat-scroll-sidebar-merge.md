# Chat Scroll Sidebar Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chat page use a fixed nav/sidebar shell where only the conversation pane scrolls, and merge 小勞鼠 into the sidebar header/control area.

**Architecture:** Keep the existing React component boundaries. `Layout.jsx` owns the viewport shell, `ChatPage.jsx` owns the chat page flex regions and state wiring, and `ConversationRail.jsx` owns the combined assistant/sidebar UI.

**Tech Stack:** React 18, Vite, Tailwind CSS v4 utility classes.

---

## File Structure

- Modify `src/components/Layout.jsx`: change app shell from document-scrolling layout to viewport-height flex shell with an overflow-managed route outlet.
- Modify `src/pages/ChatPage.jsx`: make the route content fill the available height, move role controls into `ConversationRail`, and make only the message pane scroll.
- Modify `src/features/chat/ConversationRail.jsx`: render the 小勞鼠 assistant card, identity toggle, new conversation button, and independently scrollable conversation list.
- Verify with `npm run build`. There is no configured unit test runner in `package.json`.

---

### Task 1: App Shell Viewport Layout

**Files:**
- Modify: `src/components/Layout.jsx`

- [ ] **Step 1: Inspect the current layout shell**

Run: `Get-Content -LiteralPath src\components\Layout.jsx`

Expected: The file renders `div.flex.min-h-screen.flex-col`, `NavBar`, and `main.flex-1`.

- [ ] **Step 2: Update the shell classes**

Replace the component with:

```jsx
import { Outlet } from "react-router-dom";
import NavBar from "./NavBar.jsx";

export default function Layout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f6f8fb]">
      <NavBar />
      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Build-check the shell change**

Run: `npm run build`

Expected: Build succeeds. If it fails, the error should point to JSX syntax or import issues introduced by this task.

---

### Task 2: Sidebar Control Center

**Files:**
- Modify: `src/features/chat/ConversationRail.jsx`

- [ ] **Step 1: Inspect the current rail**

Run: `Get-Content -LiteralPath src\features\chat\ConversationRail.jsx`

Expected: The component accepts `conversations`, `activeId`, `onSelect`, and `onNew`, and renders a new-conversation button plus the conversation list.

- [ ] **Step 2: Replace `ConversationRail.jsx` with the merged sidebar**

Use this implementation:

```jsx
import { scenarioById } from "../../data/scenarios.js";
import IdentityToggle from "./IdentityToggle.jsx";

export default function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  role,
  roleBadge,
  onRoleChange,
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-navy-100 bg-white px-4 py-4">
      <div className="rounded-xl border border-navy-100 bg-navy-50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
              <path
                d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Z"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M9 13h.01M15 13h.01"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M12 16c-1 0-1.5.6-1.5.6M7 7l-1.5-2M17 7l1.5-2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-brand">小勞鼠</div>
            <div className="mt-0.5 text-xs leading-5 text-navy-400">
              勞動法規智慧助理
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs text-navy-500">
          目前身份：<span className="font-semibold text-brand">{roleBadge}</span>
        </div>

        <div className="mt-3">
          <IdentityToggle role={role} onChange={onRoleChange} />
        </div>
      </div>

      <button
        type="button"
        onClick={onNew}
        className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-navy-200 bg-white py-2 text-sm font-medium text-brand transition-colors hover:bg-navy-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M12 5v14M5 12h14"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        新對話
      </button>

      <div className="mt-5 px-1 text-xs font-semibold tracking-wide text-navy-400">
        對話紀錄
      </div>

      <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
        {conversations.length === 0 && (
          <p className="px-1 py-2 text-[12px] leading-5 text-navy-300">
            目前還沒有對話紀錄。
          </p>
        )}
        {conversations.map((c) => {
          const active = c.id === activeId;
          const tag = c.scenarioId ? scenarioById[c.scenarioId]?.title : null;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={[
                "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                active ? "bg-navy-50" : "hover:bg-navy-50/60",
              ].join(" ")}
            >
              <div
                className={[
                  "truncate text-[13px]",
                  active ? "font-medium text-brand" : "text-navy-700",
                ].join(" ")}
              >
                {c.title || "新對話"}
              </div>
              {tag && (
                <div className="mt-0.5 truncate text-[11px] text-navy-400">
                  {tag}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Build-check the sidebar change**

Run: `npm run build`

Expected: Build may fail until `ChatPage.jsx` passes the new props. If it fails with missing props only at runtime risk but no compile error, continue to Task 3. JSX syntax errors must be fixed before moving on.

---

### Task 3: Chat Page Scroll Regions

**Files:**
- Modify: `src/pages/ChatPage.jsx`

- [ ] **Step 1: Remove the now-unused identity toggle import**

Delete:

```jsx
import IdentityToggle from "../features/chat/IdentityToggle.jsx";
```

- [ ] **Step 2: Pass role controls into `ConversationRail`**

Replace the current `ConversationRail` call with:

```jsx
<ConversationRail
  conversations={conversations}
  activeId={activeId}
  onSelect={handleSelectConversation}
  onNew={handleNew}
  role={role}
  roleBadge={ROLES[role].badge}
  onRoleChange={setRole}
/>
```

- [ ] **Step 3: Replace the outer chat page layout**

Change the return wrapper and main section from page-scrolling classes to fixed-height flex classes:

```jsx
return (
  <div className="flex h-full overflow-hidden">
    <ConversationRail
      conversations={conversations}
      activeId={activeId}
      onSelect={handleSelectConversation}
      onNew={handleNew}
      role={role}
      roleBadge={ROLES[role].badge}
      onRoleChange={setRole}
    />

    <section className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-6">
      <div className="flex shrink-0 items-center justify-between">
        <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-1 text-sm text-navy-700">
          <span className="h-2 w-2 rounded-full bg-brand" />
          對話工作區
        </span>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
        {isEmpty ? (
          <EmptyState
            scenarioId={scenarioId}
            onSelectScenario={setScenarioId}
            chips={chips}
            busy={busy}
            onPick={(chip) =>
              ask({ question: chip.text, responseKey: chip.responseKey })
            }
          />
        ) : (
          <MessageList
            messages={messages}
            onRetry={onRetry}
            onOpenPath={({ question, cyphers }) =>
              setDrawer({ open: true, question, cyphers })
            }
          />
        )}
      </div>

      {!isEmpty && (
        <div className="mt-3 shrink-0">
          <ExampleChips
            chips={chips}
            disabled={busy}
            onPick={(chip) =>
              ask({ question: chip.text, responseKey: chip.responseKey })
            }
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-3 shrink-0">
        <div className="flex items-end gap-2 rounded-xl border border-navy-200 bg-white p-2 focus-within:border-brand">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            rows={1}
            placeholder="輸入勞動法規問題，或請小勞鼠協助釐清情境"
            className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-navy-800 outline-none placeholder:text-navy-300"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            送出
          </button>
        </div>
      </form>
    </section>

    <ReasoningDrawer
      open={drawer.open}
      question={drawer.question}
      cyphers={drawer.cyphers}
      onClose={() => setDrawer((d) => ({ ...d, open: false }))}
    />
  </div>
);
```

- [ ] **Step 4: Keep existing behavior untouched**

Confirm these functions are not changed:

```jsx
ask
onSubmit
onRetry
handleNew
handleSelectConversation
```

Expected: Streaming, retry, scenario chips, and conversation selection keep the same behavior.

- [ ] **Step 5: Build-check the chat page change**

Run: `npm run build`

Expected: Build succeeds.

---

### Task 4: Manual Layout Verification

**Files:**
- No source changes required unless verification exposes a layout bug.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL such as `http://127.0.0.1:5173/`.

- [ ] **Step 2: Open `/chat` and check empty state**

Navigate to `/chat`.

Expected:

- Nav bar remains at the top.
- Sidebar fills the height below nav.
- 小勞鼠 appears in the sidebar header.
- Identity toggle appears in the sidebar, not the main chat column.
- Empty state is centered in the scrollable middle area.
- Input remains visible at the bottom.

- [ ] **Step 3: Create a long conversation**

Submit multiple sample prompts or use suggestion chips until messages exceed the visible height.

Expected:

- The page body does not scroll.
- Nav bar does not move.
- Sidebar does not move.
- Message pane scrolls.
- Input remains visible.

- [ ] **Step 4: Check sidebar overflow**

Create enough conversations to exceed sidebar height.

Expected:

- The conversation list scrolls inside the sidebar.
- The 小勞鼠 header and new conversation button stay visible.

- [ ] **Step 5: Stop the dev server**

Terminate the Vite process.

Expected: No background dev server remains running after verification.
