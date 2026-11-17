import React, { useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Send,
  Shield,
  Swords,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  ChatMessage,
  LobbyPlayer,
  MultiplayerRoomState,
  SaveData,
} from '../types/game';
import { MpConnectionStatus } from '../managers/MultiplayerClient';
import { AvatarBadge } from './AvatarBadge';

interface Props {
  saveData: SaveData;
  status: MpConnectionStatus;
  lobbyPlayers: LobbyPlayer[];
  rooms: MultiplayerRoomState[];
  currentRoom: MultiplayerRoomState | null;
  chatMessages: ChatMessage[];
  onConnect: () => void;
  onQuickMatch: (mode: 'coop' | 'competitive') => void;
  onCreateRoom: (name: string, mode: 'coop' | 'competitive') => void;
  onJoinRoom: (codeOrId: string) => void;
  onLeaveRoom: () => void;
  onToggleReady: (ready: boolean) => void;
  onStartMatch: () => void;
  onInvitePlayer: (playerId: string) => void;
  onSendChat: (channel: 'lobby' | 'room', text: string) => void;
  onClose: () => void;
}

export const MultiplayerModal: React.FC<Props> = ({
  saveData,
  status,
  lobbyPlayers,
  rooms,
  currentRoom,
  chatMessages,
  onConnect,
  onQuickMatch,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onToggleReady,
  onStartMatch,
  onInvitePlayer,
  onSendChat,
  onClose,
}) => {
  const [roomName, setRoomName] = useState(`${saveData.profile.username}'s Squad`);
  const [roomMode, setRoomMode] = useState<'coop' | 'competitive'>('coop');
  const [joinCode, setJoinCode] = useState('');
  const [chatText, setChatText] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);

  const localMember = currentRoom?.members.find(
    (m) => m.playerId === saveData.profile.playerId
  );
  const isHost = currentRoom?.hostId === saveData.profile.playerId;
  const activeChannel: 'lobby' | 'room' = currentRoom ? 'room' : 'lobby';
  const filteredMessages = chatMessages.filter(
    (m) => m.channel === activeChannel || (!currentRoom && m.channel === 'lobby')
  );

  const copyRoomCode = () => {
    if (!currentRoom) return;
    navigator.clipboard?.writeText(currentRoom.roomCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/82 p-3 sm:p-4">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0c1018] border border-white/15 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#090c12]">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-100 tracking-wide">
              MULTIPLAYER DEPLOYMENT
            </h2>
            <p className="text-xs text-slate-400">
              16-player social lobby · 4-player Co-op & Competitive Zombie Survival
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-mono-tabular font-semibold ${
                status === 'connected'
                  ? 'text-emerald-400'
                  : status === 'connecting'
                  ? 'text-amber-400'
                  : 'text-red-400'
              }`}
            >
              {status === 'connected'
                ? `${lobbyPlayers.length}/16 Online`
                : status === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
            </span>
            {status === 'disconnected' && (
              <button
                onClick={onConnect}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reconnect
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close Multiplayer"
              className="p-2 rounded-lg bg-[#151b26] hover:bg-[#1e2636] text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left 7 cols: Room Management / Squad Staging */}
          <div className="lg:col-span-7 p-5 overflow-y-auto survival-scroll space-y-4">
            {currentRoom ? (
              <div className="space-y-4">
                <div className="bg-[#111723] border border-sky-500/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-sky-400 font-semibold">
                      {currentRoom.mode === 'coop' ? 'Co-op Squad Survival' : 'Competitive Survival'}
                    </div>
                    <h3 className="font-display text-xl font-bold text-slate-100">
                      {currentRoom.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="bg-[#090c12] border border-white/15 rounded-lg px-3 py-1.5 text-center">
                      <div className="text-[10px] text-slate-400 uppercase">Room Code</div>
                      <div className="font-mono-tabular text-sm font-bold text-amber-400 tracking-widest">
                        {currentRoom.roomCode}
                      </div>
                    </div>
                    <button
                      onClick={copyRoomCode}
                      className="p-2.5 rounded-lg bg-[#182131] hover:bg-[#222f46] text-slate-200 cursor-pointer"
                      title="Copy Room Code"
                    >
                      {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {currentRoom.status === 'countdown' && (
                  <div className="bg-red-950/60 border border-red-500/60 rounded-xl p-3.5 text-center">
                    <div className="font-display text-lg font-bold text-red-300 tracking-wider">
                      DEPLOYING SQUAD IN {currentRoom.countdownSec}s...
                    </div>
                  </div>
                )}

                {/* Squad Slots (Max 4) */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Squad Roster ({currentRoom.members.length}/{currentRoom.maxPlayers})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Array.from({ length: currentRoom.maxPlayers }).map((_, idx) => {
                      const m = currentRoom.members[idx];
                      if (!m) {
                        return (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-dashed border-white/10 bg-[#0a0e15] flex items-center justify-center text-xs text-slate-500"
                          >
                            Open Squad Slot · Invite from Lobby
                          </div>
                        );
                      }
                      return (
                        <div
                          key={m.playerId}
                          className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                            m.ready
                              ? 'bg-[#111e1a] border-emerald-500/50'
                              : 'bg-[#101521] border-white/12'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarBadge avatarId={m.avatarId} size={34} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-100 truncate">
                                  {m.username}
                                </span>
                                {m.isHost && <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                              </div>
                              <div className="text-[11px] font-mono-tabular text-slate-400">
                                Lv.{m.level} · {m.skin}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`text-[11px] font-semibold ${
                              m.ready ? 'text-emerald-400' : 'text-slate-400'
                            }`}
                          >
                            {m.ready ? 'READY' : 'WAITING'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Room Action Controls */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    onClick={() => onToggleReady(!localMember?.ready)}
                    className={`flex-1 py-2.5 px-4 rounded-lg font-display font-bold text-sm tracking-wider cursor-pointer ${
                      localMember?.ready
                        ? 'bg-[#1b2434] text-slate-200 border border-white/15'
                        : 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    }`}
                  >
                    {localMember?.ready ? 'CANCEL READY' : 'READY UP'}
                  </button>

                  {isHost && (
                    <button
                      onClick={onStartMatch}
                      disabled={currentRoom.status === 'countdown'}
                      className="flex-1 py-2.5 px-4 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white font-display font-bold text-sm tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      START MATCH
                    </button>
                  )}

                  <button
                    onClick={onLeaveRoom}
                    className="py-2.5 px-4 rounded-lg bg-[#1a1317] hover:bg-[#291820] border border-red-900/50 text-red-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    Leave
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Quick Match Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => onQuickMatch('coop')}
                    disabled={status !== 'connected'}
                    className="p-3.5 rounded-xl bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 disabled:opacity-45 text-left text-white cursor-pointer shadow-lg"
                  >
                    <div className="flex items-center gap-2 font-display text-base font-bold">
                      <Shield className="w-4 h-4" />
                      QUICK MATCH · CO-OP
                    </div>
                    <div className="text-[11px] text-red-100/85 mt-0.5">
                      Team up with up to 4 survivors against shared waves
                    </div>
                  </button>

                  <button
                    onClick={() => onQuickMatch('competitive')}
                    disabled={status !== 'connected'}
                    className="p-3.5 rounded-xl bg-[#141c2b] hover:bg-[#1a2538] disabled:opacity-45 border border-amber-500/40 text-left text-white cursor-pointer"
                  >
                    <div className="flex items-center gap-2 font-display text-base font-bold text-amber-300">
                      <Swords className="w-4 h-4" />
                      QUICK MATCH · COMPETITIVE
                    </div>
                    <div className="text-[11px] text-slate-300 mt-0.5">
                      Outscore & outlast rivals for top-spot gem bonuses
                    </div>
                  </button>
                </div>

                {/* Create Room & Join by Code */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-[#101521] border border-white/10 rounded-xl p-3.5 space-y-2.5">
                    <div className="text-xs font-display font-bold text-slate-200 uppercase">
                      Create Private Room
                    </div>
                    <input
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      maxLength={24}
                      placeholder="Room name"
                      className="w-full bg-[#090c12] border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-red-500/60"
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['coop', 'competitive'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setRoomMode(m)}
                          className={`py-1.5 rounded text-[11px] font-semibold uppercase border cursor-pointer ${
                            roomMode === m
                              ? 'bg-red-700 border-red-500 text-white'
                              : 'bg-[#090c12] border-white/10 text-slate-400'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => onCreateRoom(roomName, roomMode)}
                      disabled={status !== 'connected'}
                      className="w-full py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-45 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Squad Room
                    </button>
                  </div>

                  <div className="bg-[#101521] border border-white/10 rounded-xl p-3.5 flex flex-col justify-between space-y-2.5">
                    <div>
                      <div className="text-xs font-display font-bold text-slate-200 uppercase mb-1">
                        Join via Room Code
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Enter a 6-character code shared by a squad leader.
                      </p>
                    </div>
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      maxLength={6}
                      placeholder="e.g. A7K2Q9"
                      className="w-full bg-[#090c12] border border-white/10 rounded-lg px-3 py-2 text-sm font-mono-tabular tracking-widest text-amber-300 uppercase focus:outline-none focus:border-amber-500/60"
                    />
                    <button
                      onClick={() => joinCode.trim() && onJoinRoom(joinCode.trim())}
                      disabled={status !== 'connected' || joinCode.trim().length < 4}
                      className="w-full py-2 rounded-lg bg-[#1b2639] hover:bg-[#24334d] disabled:opacity-45 text-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      Join Squad
                    </button>
                  </div>
                </div>

                {/* Open Squad Rooms Browser */}
                <div>
                  <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Active Squad Rooms ({rooms.length})
                  </div>
                  {rooms.length === 0 ? (
                    <div className="p-4 rounded-xl bg-[#0e131d] border border-white/10 text-xs text-slate-400 text-center">
                      No active rooms yet — create one or use Quick Match to start a squad.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rooms.map((r) => (
                        <div
                          key={r.roomId}
                          className="p-3 rounded-lg bg-[#101521] border border-white/10 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-xs font-bold text-slate-100">{r.name}</div>
                            <div className="text-[11px] font-mono-tabular text-slate-400">
                              Code {r.roomCode} · {r.mode.toUpperCase()} · {r.status.toUpperCase()}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono-tabular text-slate-300 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-sky-400" />
                              {r.members.length}/{r.maxPlayers}
                            </span>
                            <button
                              onClick={() => onJoinRoom(r.roomId)}
                              disabled={r.status === 'playing' || r.members.length >= r.maxPlayers}
                              className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 disabled:opacity-40 text-xs font-semibold text-white cursor-pointer"
                            >
                              {r.status === 'playing' ? 'In Game' : 'Join'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right 5 cols: 16-Player Lobby Roster + Real-time Chat */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#090d14] p-4 flex flex-col gap-3 overflow-hidden">
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="text-xs font-display font-bold uppercase tracking-wider text-slate-300 mb-2">
                Online Survivors ({lobbyPlayers.length}/16)
              </div>
              <div className="flex-1 overflow-y-auto survival-scroll space-y-1.5 pr-1">
                {lobbyPlayers.map((p) => {
                  const isSelf = p.playerId === saveData.profile.playerId;
                  return (
                    <div
                      key={p.playerId}
                      className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#0f141f] border border-white/8"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarBadge avatarId={p.avatarId} size={28} />
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-100 truncate">
                            {p.username} {isSelf ? '(You)' : ''}
                          </div>
                          <div className="text-[10px] font-mono-tabular text-slate-400">
                            Lv.{p.level} · {p.status}
                          </div>
                        </div>
                      </div>
                      {!isSelf && currentRoom && (
                        <button
                          onClick={() => onInvitePlayer(p.playerId)}
                          className="px-2 py-1 rounded bg-[#182235] hover:bg-sky-700 text-[11px] text-sky-300 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <UserPlus className="w-3 h-3" />
                          Invite
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Lobby / Room Chat */}
            <div className="h-52 flex flex-col bg-[#0c111b] border border-white/10 rounded-xl p-3">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 mb-1.5">
                {currentRoom ? `Squad Chat · ${currentRoom.roomCode}` : 'Global Lobby Chat'}
              </div>
              <div className="flex-1 overflow-y-auto survival-scroll space-y-1 text-xs mb-2">
                {filteredMessages.length === 0 ? (
                  <div className="text-slate-500 text-[11px]">No comms messages yet.</div>
                ) : (
                  filteredMessages.map((m) => (
                    <div key={m.id} className="leading-snug">
                      <span className="font-semibold text-sky-400">{m.senderName}: </span>
                      <span className="text-slate-200">{m.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatText.trim()) return;
                  onSendChat(activeChannel, chatText.trim());
                  setChatText('');
                }}
                className="flex gap-1.5"
              >
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder={`Message ${activeChannel}...`}
                  disabled={status !== 'connected'}
                  className="flex-1 bg-[#090c12] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-500/60"
                />
                <button
                  type="submit"
                  disabled={status !== 'connected'}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-white cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
