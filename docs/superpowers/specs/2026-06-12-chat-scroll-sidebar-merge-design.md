# Chat Scroll Area and Sidebar Merge Design

## Goal

Update the chat page so the global nav bar and left sidebar stay fixed while the conversation content scrolls inside its own area. Merge the "小勞鼠" assistant presence into the sidebar as the sidebar header/control area.

## Current Context

- `src/components/Layout.jsx` renders the app shell with `NavBar` above the route outlet.
- `src/pages/ChatPage.jsx` owns the chat page layout, role state, scenario state, message state, streaming behavior, chips, and input form.
- `src/features/chat/ConversationRail.jsx` currently renders only the new-conversation button and conversation list.
- The current chat page uses `min-h-[calc(100vh-7rem)]` and a page-level layout, so long chat content can push the document instead of making only the conversation pane scroll.

## Chosen Direction

Use option C: make the left sidebar a fixed "小勞鼠 control center".

The sidebar should include:

- A compact assistant header/card for 小勞鼠.
- Current role/status context and identity toggle.
- The new conversation action.
- The conversation list.

The main chat column should include:

- A compact fixed top row for chat context, without duplicating sidebar controls.
- A middle scrollable area for the empty state or message list.
- Fixed bottom suggestion chips and input form.

## Layout Behavior

- The app shell should occupy the viewport height.
- `NavBar` should remain visible at the top and should not scroll with chat messages.
- The chat route should use a viewport-height region below `NavBar`.
- The left sidebar should not move when the user scrolls the conversation.
- Only the message/empty-state pane should have vertical scrolling.
- The input composer should remain visible at the bottom of the chat column.

## Component Changes

### `Layout.jsx`

Set the shell to use fixed viewport height and prevent the whole page from becoming the primary scroll container. Keep the route outlet in a flexible overflow-managed area.

### `ChatPage.jsx`

Replace the page-level scrolling layout with a fixed-height flex layout:

- Outer route container: full available height, horizontal layout, hidden overflow.
- Left side: `ConversationRail`, fixed width and full height.
- Main side: flex column, min-height zero, hidden overflow.
- Message area: `flex-1 min-h-0 overflow-y-auto`.

Move role/status display and the identity toggle into the sidebar by passing `role`, `setRole`, and role badge text to `ConversationRail`. The main chat column should not duplicate these controls.

### `ConversationRail.jsx`

Expand props so it can render:

- Assistant header/card for 小勞鼠.
- Current role badge and identity toggle.
- New conversation button.
- Scrollable conversation list.

The conversation list itself should have `min-h-0 overflow-y-auto` so it scrolls within the sidebar when many conversations exist.

## Empty State and Messages

The empty state should stay centered within the scrollable pane when there is no conversation content. Once messages exist, `MessageList` remains inside the same scrollable pane.

Suggestion chips should remain above the input when messages exist. They should not be part of the scrollable message pane.

## Testing and Verification

This project currently has no configured test script. Verification should use:

- `npm run build` to catch JSX and CSS class mistakes.
- Manual browser check at desktop size:
  - Long chat content scrolls only in the message pane.
  - Nav bar stays fixed.
  - Sidebar stays fixed.
  - Input stays visible.
  - Sidebar conversation list scrolls independently if it overflows.

## Out of Scope

- Changing streaming behavior.
- Changing API calls or mock response data.
- Redesigning non-chat routes.
- Adding persistence or deleting conversations.
