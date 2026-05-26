/**
 * AppHeader — 사용자 역할(userRole)에 따라 헤더를 자동 선택합니다.
 *
 *   client  → Header_client (다크 네이비 네비게이션)
 *   partner → Header_after  (화이트 네비게이션)
 *   null    → Header_after  (기본값 — 비로그인/랜딩 포함)
 *
 * 사용법: 공유 페이지 최상단에 <Header_client /> 나 <Header_after /> 대신
 *         <AppHeader /> 하나만 넣으면 됩니다.
 */
import useStore from "../store/useStore";
import Header_home from "./Header_home";
import Header_client from "./Header_client";
import Header_partner from "./Header_partner";

export default function AppHeader() {
  const userRole = useStore((state) => state.userRole);
  return userRole === "client" ? <Header_client /> : userRole === "partner" ? <Header_partner /> : <Header_home />;
}
