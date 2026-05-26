import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Clock, Award, Bookmark, ShoppingBag, Search } from "lucide-react";
import AppHeader from "../components/AppHeader";
import home3Img from "../assets/home3.png";
import { useLanguage } from "../i18n/LanguageContext";

const F = "'Pretendard', sans-serif";
const FH = "'Plus Jakarta Sans', 'Pretendard', sans-serif";

const CATEGORY_KEYS = ["intermediary", "itServices", "internalSystems", "aiMl", "commerce", "website", "marketing"];
const CATEGORY_KO   = ["중개 플랫폼", "IT 서비스 구축", "내부 업무시스템", "AI / 머신러닝", "커머스 / 쇼핑몰", "웹사이트 제작", "마케팅"];
const CAT_KEY_MAP   = Object.fromEntries(CATEGORY_KO.map((k, i) => [k, CATEGORY_KEYS[i]]));

const SUB_KEY_MAP = {
  "전체": "all", "구인구직": "recruitment", "의료": "medical", "광고": "advertising",
  "여행": "travel", "용역": "service", "건설": "construction", "중고거래": "usedGoods",
  "자동차": "usedGoods",
  "반려동물": "pets", "교육": "education", "부동산": "realEstate", "콘텐츠": "content",
  "기타": "other", "LMS / 강의 플랫폼": "lms", "POS / 키오스크": "pos",
  "관제 / 모니터링": "monitoring", "디지털 자산": "digitalAsset", "CRM 고객관리": "crm",
  "ERP 전사자원관리": "erp", "MES 생산관리": "mes", "PMS 프로젝트관리": "pms",
  "통합물류관리": "logistics", "데이터 분석": "dataAnalysis", "머신러닝": "ml",
  "챗봇": "chatbot", "Gen AI 서비스": "genAI", "입점몰": "openMall", "자사몰": "ownMall",
  "라이브 커머스": "liveCommerce", "상세 페이지": "detailPage", "렌딩 페이지": "landingPage",
  "사이트 유지보수": "siteManagement", "SEO 최적화": "seo", "마케팅 자동화": "marketingAuto",
  "앱 패키징": "appPackaging",
};

const SUB_CATEGORIES = {
    "중개 플랫폼": ["전체", "구인구직", "의료", "광고", "여행", "용역", "건설", "중고거래", "반려동물", "교육", "부동산", "콘텐츠", "기타"],
    "IT 서비스 구축": ["전체", "LMS / 강의 플랫폼", "POS / 키오스크", "관제 / 모니터링", "디지털 자산", "기타"],
    "내부 업무시스템": ["전체", "CRM 고객관리", "ERP 전사자원관리", "MES 생산관리", "PMS 프로젝트관리", "통합물류관리", "데이터 분석", "기타"],
    "AI / 머신러닝": ["전체", "머신러닝", "챗봇", "Gen AI 서비스", "기타"],
    "커머스 / 쇼핑몰": ["전체", "입점몰", "자사몰", "라이브 커머스", "기타"],
    "웹사이트 제작": ["전체", "상세 페이지", "렌딩 페이지", "사이트 유지보수", "기타"],
    "마케팅": ["전체", "SEO 최적화", "마케팅 자동화", "앱 패키징", "기타"],
};

const SOLUTIONS = [
    // 1. 중개 플랫폼 (12개)
    { id: 1, title: "데이터 중심 채용 매칭 플랫폼", majorCategory: "중개 플랫폼", subCategory: "구인구직", duration: "4개월", price: "₩25,000,000~", rating: 4.9, reviews: 128, tags: ["AI", "Matching", "Big Data"], description: "AI 기반 직무 역량 분석과 문화 적합도를 고려한 지능형 채용 매칭 시스템을 제공합니다.", partner: "NextGen AI Lab" },
    { id: 2, title: "프롭테크 부동산 중개 시스템", majorCategory: "중개 플랫폼", subCategory: "부동산", duration: "5개월", price: "₩38,000,000~", rating: 4.8, reviews: 95, tags: ["Blockchain", "3D Tour", "PropTech"], description: "블록체인 기반 부동산 거래 투명성을 확보하고 3D 가상 투어와 AI 가격 예측을 제공합니다.", partner: "Zenith Solutions" },
    { id: 3, title: "비대면 의료 매칭 플랫폼", majorCategory: "중개 플랫폼", subCategory: "의료", duration: "6개월", price: "₩45,000,000~", rating: 4.8, reviews: 110, tags: ["Telemedicine", "HIPAA", "AI Diagnosis"], description: "HIPAA 준수 비디오 상담과 AI 증상 분석을 결합한 원격 의료 매칭 솔루션입니다.", partner: "MedConnect Labs" },
    { id: 4, title: "중고차 매매 중개 솔루션", majorCategory: "중개 플랫폼", subCategory: "자동차", duration: "3개월", price: "₩20,000,000~", rating: 4.7, reviews: 62, tags: ["Used Car", "Inspection", "Trust"], description: "신뢰할 수 있는 차량 점검 데이터와 실시간 경매 시스템을 통합한 중고차 매매 솔루션입니다.", partner: "AutoTrust" },
    { id: 5, title: "반려동물 돌봄 매칭 서비스", majorCategory: "중개 플랫폼", subCategory: "반려동물", duration: "2개월", price: "₩12,000,000~", rating: 4.9, reviews: 88, tags: ["Pet Care", "Matching", "GPS"], description: "검증된 펫시터와 보호자를 연결하고 실시간 산책 경로를 공유하는 반려동물 돌봄 플랫폼입니다.", partner: "PetPals" },
    { id: 6, title: "건설 인력 매칭 플랫폼", majorCategory: "중개 플랫폼", subCategory: "건설", duration: "4개월", price: "₩30,000,000~", rating: 4.6, reviews: 54, tags: ["Construction", "HR", "Daily Work"], description: "건설 현장의 인력 수요와 작업자를 실시간으로 매칭하고 노무 관리를 자동화하는 시스템입니다.", partner: "BuildMatch" },
    { id: 7, title: "광고 매체사 중개 솔루션", majorCategory: "중개 플랫폼", subCategory: "광고", duration: "3개월", price: "₩18,000,000~", rating: 4.7, reviews: 41, tags: ["AdTech", "Bidding", "Analytics"], description: "광고주와 매체사를 연결하여 최적의 광고 지면을 입찰하고 성과를 분석하는 플랫폼입니다.", partner: "AdLinker" },
    { id: 8, title: "여행 가이드 매칭 시스템", majorCategory: "중개 플랫폼", subCategory: "여행", duration: "3개월", price: "₩16,000,000~", rating: 4.8, reviews: 76, tags: ["Travel", "Guide", "Local"], description: "현지인 가이드와 여행자를 개인의 취향에 맞춰 매칭해주는 테마 여행 중개 솔루션입니다.", partner: "GlobalJourney" },
    { id: 9, title: "전문 인력 용역 중개 플랫폼", majorCategory: "중개 플랫폼", subCategory: "용역", duration: "4개월", price: "₩28,000,000~", rating: 4.5, reviews: 49, tags: ["Outsourcing", "Professional", "Legal"], description: "전문직 프리랜서와 기업 간의 외주 계약을 안전하게 중개하고 대금을 보호하는 시스템입니다.", partner: "ExpertNode" },
    { id: 10, title: "중고거래 안심 플랫폼", majorCategory: "중개 플랫폼", subCategory: "중고거래", duration: "4개월", price: "₩22,000,000~", rating: 4.7, reviews: 103, tags: ["Safe Pay", "C2C", "Fraud Detection"], description: "AI 사기 탐지 시스템과 에스크로 결제를 통합한 안전한 지역 기반 중고거래 플랫폼입니다.", partner: "SafeMarket" },
    { id: 11, title: "방과 후 교육 매칭 플랫폼", majorCategory: "중개 플랫폼", subCategory: "교육", duration: "3개월", price: "₩15,000,000~", rating: 4.9, reviews: 82, tags: ["Education", "After School", "Teacher"], description: "학생의 학습 수준과 성향을 분석하여 최적의 강사와 교육 콘텐츠를 추천하는 시스템입니다.", partner: "StudyLink" },
    { id: 12, title: "디지털 콘텐츠 마켓플레이스", majorCategory: "중개 플랫폼", subCategory: "콘텐츠", duration: "3개월", price: "₩19,000,000~", rating: 4.8, reviews: 65, tags: ["Digital Asset", "NFT", "Creator"], description: "창작자의 디지털 저작물을 안전하게 거래하고 로열티를 관리하는 콘텐츠 중개 플랫폼입니다.", partner: "CreativeCloud" },

    // 2. IT 서비스 구축 (12개)
    { id: 13, title: "LMS 기반 온라인 강의 솔루션", majorCategory: "IT 서비스 구축", subCategory: "LMS / 강의 플랫폼", duration: "3개월", price: "₩15,000,000~", rating: 4.7, reviews: 45, tags: ["LMS", "Education", "Video Stream"], description: "안정적인 영상 스트리밍과 진도율 관리 기능을 갖춘 맞춤형 강의 플랫폼입니다.", partner: "EduTech Systems" },
    { id: 14, title: "지능형 POS 결제 시스템", majorCategory: "IT 서비스 구축", subCategory: "POS / 키오스크", duration: "4개월", price: "₩18,000,000~", rating: 4.8, reviews: 38, tags: ["POS", "Retail", "Inventory"], description: "오프라인 매장 결제부터 재고 관리, 매출 분석까지 통합 제공하는 스마트 POS 시스템입니다.", partner: "SmartRetail" },
    { id: 15, title: "스마트 무인 키오스크 솔루션", majorCategory: "IT 서비스 구축", subCategory: "POS / 키오스크", duration: "4개월", price: "₩22,000,000~", rating: 4.6, reviews: 29, tags: ["Kiosk", "UI/UX", "Payment"], description: "직관적인 UI와 다양한 결제 수단을 지원하는 무인 주문 및 안내 키오스크 솔루션입니다.", partner: "KioskGo" },
    { id: 16, title: "서버 관제 및 모니터링 시스템", majorCategory: "IT 서비스 구축", subCategory: "관제 / 모니터링", duration: "5개월", price: "₩35,000,000~", rating: 4.7, reviews: 22, tags: ["Monitoring", "Cloud", "Security"], description: "대규모 서버 인프라의 상태를 실시간으로 모니터링하고 장애를 조기에 감지하는 관제 시스템입니다.", partner: "OpsWatcher" },
    { id: 17, title: "디지털 자산 지갑 및 관리 솔루션", majorCategory: "IT 서비스 구축", subCategory: "디지털 자산", duration: "6개월", price: "₩60,000,000~", rating: 4.9, reviews: 15, tags: ["Wallet", "Blockchain", "Security"], description: "금융권 수준의 보안 기술이 적용된 디지털 자산 보관 및 거래 관리 시스템입니다.", partner: "CryptoVault" },
    { id: 18, title: "기업 전용 메신저 및 협업툴", majorCategory: "IT 서비스 구축", subCategory: "기타", duration: "4개월", price: "₩25,000,000~", rating: 4.5, reviews: 31, tags: ["Messenger", "Collaboration", "Private"], description: "데이터 보안이 강화된 폐쇄형 사내 메신저 및 문서 협업 도구 구축 서비스입니다.", partner: "BizTalk" },
    { id: 19, title: "스마트 팩토리 모니터링 플랫폼", majorCategory: "IT 서비스 구축", subCategory: "관제 / 모니터링", duration: "6개월", price: "₩50,000,000~", rating: 4.8, reviews: 19, tags: ["IoT", "Manufacturing", "Dashboard"], description: "공장 설비의 IoT 데이터를 수집하여 가동률을 실시간 시각화하는 모니터링 시스템입니다.", partner: "FactoryInsight" },
    { id: 20, title: "가상 자산 거래소 플랫폼 구축", majorCategory: "IT 서비스 구축", subCategory: "디지털 자산", duration: "8개월", price: "₩120,000,000~", rating: 4.7, reviews: 12, tags: ["Exchange", "Trading", "Engine"], description: "초당 수만 건의 거래를 처리할 수 있는 매칭 엔진을 탑재한 고성능 거래소 솔루션입니다.", partner: "TradeEngine" },
    { id: 21, title: "맞춤형 학습 관리 시스템 (LMS)", majorCategory: "IT 서비스 구축", subCategory: "LMS / 강의 플랫폼", duration: "4개월", price: "₩28,000,000~", rating: 4.9, reviews: 27, tags: ["LMS", "B2B", "Custom"], description: "기업 교육이나 자격증 시험 대비를 위해 특화된 고기능성 학습 관리 플랫폼입니다.", partner: "LearnMaster" },
    { id: 22, title: "차량 관제 및 FMS 솔루션", majorCategory: "IT 서비스 구축", subCategory: "관제 / 모니터링", duration: "5개월", price: "₩40,000,000~", rating: 4.6, reviews: 33, tags: ["FMS", "GPS", "Logistics"], description: "법인 차량의 위치와 운행 상태를 실시간 관리하여 유지 비용을 절감하는 관제 시스템입니다.", partner: "FleetForce" },
    { id: 23, title: "STB 및 IPTV 서비스 플랫폼", majorCategory: "IT 서비스 구축", subCategory: "기타", duration: "7개월", price: "₩85,000,000~", rating: 4.4, reviews: 14, tags: ["IPTV", "Streaming", "VOD"], description: "셋톱박스 기반의 미디어 스트리밍 및 VOD 서비스를 위한 백엔드와 UI 구축 솔루션입니다.", partner: "MediaStream" },
    { id: 24, title: "프랜차이즈 통합 관리 POS", majorCategory: "IT 서비스 구축", subCategory: "POS / 키오스크", duration: "5개월", price: "₩32,000,000~", rating: 4.8, reviews: 25, tags: ["Franchise", "POS", "Multi-store"], description: "수백 개의 가맹점을 통합 관리하고 본사-매장 간 데이터를 동기화하는 POS 솔루션입니다.", partner: "StoreSync" },

    // 3. 내부 업무시스템 (12개)
    { id: 25, title: "클라우드 기반 맞춤형 ERP", majorCategory: "내부 업무시스템", subCategory: "ERP 전사자원관리", duration: "6개월", price: "₩55,000,000~", rating: 4.6, reviews: 32, tags: ["Cloud", "ERP", "Scalable"], description: "중소기업을 위한 생산, 재고, 회계 통합 관리 클라우드 ERP 솔루션입니다.", partner: "BusinessSync" },
    { id: 26, title: "데이터 기반 CRM 고객 관리", majorCategory: "내부 업무시스템", subCategory: "CRM 고객관리", duration: "3개월", price: "₩15,000,000~", rating: 4.8, reviews: 47, tags: ["CRM", "Marketing", "Sales"], description: "고객 행동 데이터를 분석하여 마케팅 자동화와 영업 기회 발굴을 돕는 CRM 솔루션입니다.", partner: "CustomerFlow" },
    { id: 27, title: "스마트 제조 실행 시스템 (MES)", majorCategory: "내부 업무시스템", subCategory: "MES 생산관리", duration: "5개월", price: "₩48,000,000~", rating: 4.7, reviews: 21, tags: ["MES", "Factory", "Quality"], description: "생산 공정의 실시간 모니터링과 불량률 관리를 최적화하는 제조 현장 실행 시스템입니다.", partner: "SmartFactory" },
    { id: 28, title: "기업용 프로젝트 관리 시스템 (PMS)", majorCategory: "내부 업무시스템", subCategory: "PMS 프로젝트관리", duration: "3개월", price: "₩12,000,000~", rating: 4.9, reviews: 56, tags: ["PMS", "Agile", "Resource"], description: "대규모 프로젝트의 일정, 인적 자원, 예산을 통합 관리하는 엔터프라이즈급 PMS 솔루션입니다.", partner: "ProjectHub" },
    { id: 29, title: "통합 물류 및 창고 관리 시스템", majorCategory: "내부 업무시스템", subCategory: "통합물류관리", duration: "5개월", price: "₩40,000,000~", rating: 4.5, reviews: 39, tags: ["WMS", "Logistics", "Inventory"], description: "입고부터 출고까지 물류 전 과정을 자동화하고 재고 정확도를 극대화하는 솔루션입니다.", partner: "LogiSystem" },
    { id: 30, title: "비즈니스 인텔리전스 데이터 분석", majorCategory: "내부 업무시스템", subCategory: "데이터 분석", duration: "4개월", price: "₩30,000,000~", rating: 4.8, reviews: 28, tags: ["BI", "Analytics", "Big Data"], description: "산재된 데이터를 수집하여 의사결정에 필요한 핵심 지표를 대시보드로 시각화하는 솔루션입니다.", partner: "DataInsight" },
    { id: 31, title: "인사 및 근태 관리 시스템", majorCategory: "내부 업무시스템", subCategory: "기타", duration: "3개월", price: "₩10,000,000~", rating: 4.7, reviews: 63, tags: ["HR", "Work", "Salary"], description: "유연근무제와 복잡한 급여 계산을 자동화하여 인사팀의 업무 효율을 높이는 시스템입니다.", partner: "HRMaster" },
    { id: 32, title: "영업 자동화(SFA) 시스템", majorCategory: "내부 업무시스템", subCategory: "CRM 고객관리", duration: "4개월", price: "₩22,000,000~", rating: 4.6, reviews: 34, tags: ["SFA", "Sales", "Automation"], description: "영업 활동 기록부터 계약 관리까지 영업 전 과정을 체계화하는 영업 자동화 솔루션입니다.", partner: "SalesPro" },
    { id: 33, title: "생산 계획 및 스케줄링(APS)", majorCategory: "내부 업무시스템", subCategory: "MES 생산관리", duration: "5개월", price: "₩45,000,000~", rating: 4.8, reviews: 18, tags: ["APS", "Scheduling", "Optimized"], description: "제한된 자원 내에서 생산 효율을 극대화하기 위한 AI 기반 최적화 스케줄링 시스템입니다.", partner: "PlanAI" },
    { id: 34, title: "원가 관리 및 분석 시스템", majorCategory: "내부 업무시스템", subCategory: "ERP 전사자원관리", duration: "4개월", price: "₩25,000,000~", rating: 4.7, reviews: 26, tags: ["Costing", "Analysis", "ERP"], description: "제품별 정교한 원가 산출과 수익성 분석을 제공하여 경영 전략 수립을 지원하는 시스템입니다.", partner: "CostInsight" },
    { id: 35, title: "디지털 문서 자산 관리(EDMS)", majorCategory: "내부 업무시스템", subCategory: "기타", duration: "3개월", price: "₩18,000,000~", rating: 4.5, reviews: 42, tags: ["EDMS", "Security", "Document"], description: "사내의 모든 중요 문서를 디지털화하고 권한별로 안전하게 공유·보관하는 시스템입니다.", partner: "DocuGate" },
    { id: 36, title: "실시간 공급망 관리(SCM)", majorCategory: "내부 업무시스템", subCategory: "통합물류관리", duration: "6개월", price: "₩65,000,000~", rating: 4.9, reviews: 16, tags: ["SCM", "Global", "Supply Chain"], description: "협력사와의 실시간 데이터 연동으로 공급망 리스크를 관리하고 최적 재고를 유지하는 솔루션입니다.", partner: "ChainConnect" },

    // 4. AI / 머신러닝 (12개)
    { id: 37, title: "LLM 기반 기업용 챗봇 서비스", majorCategory: "AI / 머신러닝", subCategory: "챗봇", duration: "2개월", price: "₩20,000,000~", rating: 4.9, reviews: 67, tags: ["LLM", "GPT-4", "Automation"], description: "사내 문서를 학습하여 정확한 답변을 제공하는 지능형 사내 챗봇 시스템입니다.", partner: "AI Factory" },
    { id: 38, title: "이미지 기반 제품 결함 탐지 AI", majorCategory: "AI / 머신러닝", subCategory: "머신러닝", duration: "4개월", price: "₩35,000,000~", rating: 4.8, reviews: 24, tags: ["Computer Vision", "ML", "Quality"], description: "딥러닝 기술을 활용하여 제조 라인에서 제품의 미세한 결함을 자동으로 찾아내는 솔루션입니다.", partner: "VisionNext" },
    { id: 39, title: "생성형 AI 기반 콘텐츠 제작툴", majorCategory: "AI / 머신러닝", subCategory: "Gen AI 서비스", duration: "3개월", price: "₩25,000,000~", rating: 4.7, reviews: 52, tags: ["Generative AI", "Content", "Marketing"], description: "텍스트 입력만으로 고품질의 홍보 이미지와 카피라이팅을 자동 생성하는 AI 서비스입니다.", partner: "GeniusAI" },
    { id: 40, title: "시계열 데이터 예측 분석 솔루션", majorCategory: "AI / 머신러닝", subCategory: "머신러닝", duration: "5개월", price: "₩40,000,000~", rating: 4.6, reviews: 31, tags: ["Prediction", "TimeSeries", "ML"], description: "과거 데이터를 바탕으로 향후 매출, 재고 수요 등을 정교하게 예측하는 머신러닝 엔진입니다.", partner: "Predictive" },
    { id: 41, title: "음성 인식 및 상담 분석 AI", majorCategory: "AI / 머신러닝", subCategory: "기타", duration: "4개월", price: "₩30,000,000~", rating: 4.8, reviews: 19, tags: ["STT", "Speech", "Analysis"], description: "콜센터 통화 내용을 텍스트로 변환하고 고객의 감정과 주요 키워드를 분석하는 시스템입니다.", partner: "VoiceLink" },
    { id: 42, title: "추천 알고리즘 커스텀 구축", majorCategory: "AI / 머신러닝", subCategory: "머신러닝", duration: "3개월", price: "₩22,000,000~", rating: 4.9, reviews: 44, tags: ["Recommendation", "ML", "E-commerce"], description: "사용자의 행동 로그를 분석하여 가장 구매 확률이 높은 상품을 추천하는 개인화 엔진입니다.", partner: "AlgoLab" },
    { id: 43, title: "다국어 실시간 번역 챗봇", majorCategory: "AI / 머신러닝", subCategory: "챗봇", duration: "3개월", price: "₩18,000,000~", rating: 4.7, reviews: 38, tags: ["Translation", "NLP", "Global"], description: "전 세계 고객과 모국어로 소통할 수 있도록 실시간 번역 기능을 탑재한 고객 응대 챗봇입니다.", partner: "GlobeChat" },
    { id: 44, title: "AI 기반 문서 자동 분류/요약", majorCategory: "AI / 머신러닝", subCategory: "Gen AI 서비스", duration: "3개월", price: "₩15,000,000~", rating: 4.8, reviews: 29, tags: ["NLP", "Summarization", "Office"], description: "수천 건의 문서를 주제별로 자동 분류하고 핵심 내용을 한 문장으로 요약해주는 솔루션입니다.", partner: "TextMind" },
    { id: 45, title: "금융 사기 의심 거래 탐지 AI", majorCategory: "AI / 머신러닝", subCategory: "머신러닝", duration: "5개월", price: "₩50,000,000~", rating: 4.9, reviews: 17, tags: ["FDS", "Finance", "Security"], description: "비정상적인 결제 패턴을 실시간으로 감지하여 금융 사고를 예방하는 고도화된 AI 모델입니다.", partner: "FinanceAI" },
    { id: 46, title: "가상 휴먼 아바타 생성 엔진", majorCategory: "AI / 머신러닝", subCategory: "Gen AI 서비스", duration: "6개월", price: "₩80,000,000~", rating: 4.6, reviews: 11, tags: ["Virtual Human", "Video", "AI"], description: "실제 사람과 유사한 가상 아바타가 자연스럽게 말하고 움직이는 영상을 제작하는 기술입니다.", partner: "AvatarStudio" },
    { id: 47, title: "AI 데이터 라벨링 자동화 툴", majorCategory: "AI / 머신러닝", subCategory: "기타", duration: "4개월", price: "₩28,000,000~", rating: 4.5, reviews: 25, tags: ["Data Labeling", "Auto", "ML Ops"], description: "머신러닝 학습용 데이터를 구축할 때 AI가 먼저 라벨링을 수행하여 작업 시간을 단축하는 도구입니다.", partner: "DataAnnotate" },
    { id: 48, title: "자율주행 장애물 인식 시스템", majorCategory: "AI / 머신러닝", subCategory: "머신러닝", duration: "8개월", price: "₩150,000,000~", rating: 4.7, reviews: 9, tags: ["Autonomous", "Lidar", "Vision"], description: "주변 사물을 인식하고 거리를 계산하여 충돌을 방지하는 로봇 및 자율주행 특화 AI 모델입니다.", partner: "RoboMotion" },

    // 5. 커머스 / 쇼핑몰 (12개)
    { id: 49, title: "멀티채널 입점형 쇼핑몰 플랫폼", majorCategory: "커머스 / 쇼핑몰", subCategory: "입점몰", duration: "5개월", price: "₩42,000,000~", rating: 4.8, reviews: 81, tags: ["Marketplace", "Payment", "Vendor Management"], description: "다수의 입점업체가 입점하여 판매할 수 있는 고도화된 오픈마켓 솔루션입니다.", partner: "CommerceHub" },
    { id: 50, title: "고성능 브랜드 자사몰 구축", majorCategory: "커머스 / 쇼핑몰", subCategory: "자사몰", duration: "3개월", price: "₩15,000,000~", rating: 4.9, reviews: 124, tags: ["Brand Mall", "D2C", "Fast UI"], description: "브랜드 정체성을 살린 세련된 디자인과 빠른 속도를 자랑하는 고품질 자사 쇼핑몰 구축 서비스입니다.", partner: "ShopDesigner" },
    { id: 51, title: "라이브 커머스 통합 솔루션", majorCategory: "커머스 / 쇼핑몰", subCategory: "라이브 커머스", duration: "4개월", price: "₩30,000,000~", rating: 4.7, reviews: 59, tags: ["Live Streaming", "Shopping", "Interaction"], description: "실시간 방송을 통해 상품을 판매하고 채팅으로 소통하는 인터랙티브 라이브 쇼핑 플랫폼입니다.", partner: "LiveStreamer" },
    { id: 52, title: "글로벌 크로스보더 쇼핑몰", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "4개월", price: "₩25,000,000~", rating: 4.8, reviews: 43, tags: ["Global", "Multi-currency", "Logistics"], description: "해외 결제, 다국어 지원, 국제 배송 시스템이 연동된 글로벌 시장 공략용 커머스 플랫폼입니다.", partner: "GlobalShop" },
    { id: 53, title: "정기 구독형 커머스 시스템", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "3개월", price: "₩18,000,000~", rating: 4.9, reviews: 71, tags: ["Subscription", "Billing", "Retention"], description: "주기적인 자동 결제와 정기 배송 관리를 지원하는 구독 비즈니스 특화 솔루션입니다.", partner: "Subscripto" },
    { id: 54, title: "식음료 전용 O2O 주문 앱", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "4개월", price: "₩22,000,000~", rating: 4.6, reviews: 92, tags: ["O2O", "Delivery", "App"], description: "테이크아웃 예약 및 배달 주문이 가능한 F&B 비즈니스용 모바일 커머스 앱 솔루션입니다.", partner: "OrderNow" },
    { id: 55, title: "B2B 폐쇄형 복지몰 플랫폼", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "4개월", price: "₩28,000,000~", rating: 4.7, reviews: 36, tags: ["B2B", "Welfare", "Private"], description: "특정 기업의 임직원만 이용 가능한 폐쇄형 복지몰 및 포인트 결제 시스템입니다.", partner: "WelfareHub" },
    { id: 56, title: "소셜 커머스 및 공동구매 툴", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "3개월", price: "₩16,000,000~", rating: 4.5, reviews: 48, tags: ["Social", "Group Buy", "SNS"], description: "사용자가 친구를 초대하여 할인 혜택을 받는 공동구매 및 소셜 공유 기능 특화 마켓입니다.", partner: "SocialBuy" },
    { id: 57, title: "무인 점포 스마트 커머스", majorCategory: "커머스 / 쇼핑몰", subCategory: "기타", duration: "5개월", price: "₩45,000,000~", rating: 4.8, reviews: 23, tags: ["Unmanned", "QR Code", "IoT"], description: "매장 내 QR 결제와 재고 센서가 연동된 무인 상점 운영 및 관리 솔루션입니다.", partner: "SmartShop" },
    { id: 58, title: "뷰티/패션 특화 비주얼 커머스", majorCategory: "커머스 / 쇼핑몰", subCategory: "자사몰", duration: "3개월", price: "₩20,000,000~", rating: 4.9, reviews: 66, tags: ["Visual", "Fashion", "Grid"], description: "고해상도 이미지와 룩북 형태의 그리드를 강조한 감각적인 패션/뷰티 전용 쇼핑몰입니다.", partner: "VogueBuild" },
    { id: 59, title: "수수료 정산 및 파트너 센터", majorCategory: "커머스 / 쇼핑몰", subCategory: "입점몰", duration: "4개월", price: "₩35,000,000~", rating: 4.7, reviews: 29, tags: ["Settlement", "Partner Admin", "API"], description: "복잡한 판매 수수료 계산과 파트너별 정산 관리를 자동화하는 커머스 백오피스 솔루션입니다.", partner: "BackOffice" },
    { id: 60, title: "중고 명품 위탁 판매 플랫폼", majorCategory: "커머스 / 쇼핑몰", subCategory: "입점몰", duration: "4개월", price: "₩38,000,000~", rating: 4.8, reviews: 51, tags: ["Luxury", "Inspection", "Consignment"], description: "감정 평가와 위탁 판매 프로세스가 포함된 프리미엄 중고 명품 거래 전용 플랫폼입니다.", partner: "LuxMarket" },

    // 6. 웹사이트 제작 (12개)
    { id: 61, title: "고전환율 랜딩 페이지 패키지", majorCategory: "웹사이트 제작", subCategory: "렌딩 페이지", duration: "2주", price: "₩2,500,000~", rating: 4.9, reviews: 156, tags: ["Conversion", "UI/UX", "Fast Build"], description: "마케팅 성과를 극대화하기 위해 설계된 고퀄리티 랜딩 페이지 제작 및 A/B 테스트 지원 서비스입니다.", partner: "PixelPerfect" },
    { id: 62, title: "프리미엄 기업 홍보 웹사이트", majorCategory: "웹사이트 제작", subCategory: "전체", duration: "4주", price: "₩8,000,000~", rating: 4.8, reviews: 92, tags: ["Corporate", "Modern", "SEO"], description: "회사의 신뢰도를 높여주는 세련된 디자인과 검색 엔진 최적화가 완벽히 적용된 기업 사이트입니다.", partner: "WebCraft" },
    { id: 63, title: "반응형 웹 디자인 및 퍼블리싱", majorCategory: "웹사이트 제작", subCategory: "사이트 유지보수", duration: "3주", price: "₩4,000,000~", rating: 4.7, reviews: 74, tags: ["Responsive", "CSS", "Mobile-first"], description: "PC부터 모바일까지 모든 기기에서 완벽하게 작동하는 반응형 웹사이트를 제작해 드립니다.", partner: "FlowWeb" },
    { id: 64, title: "이벤트/프로모션 상세 페이지", majorCategory: "웹사이트 제작", subCategory: "상세 페이지", duration: "1주", price: "₩1,200,000~", rating: 4.8, reviews: 112, tags: ["Promo", "Visual", "Quick"], description: "단기간 내 집중적인 주목도를 끌어내야 하는 이벤트 및 프로모션용 상세 페이지 제작입니다.", partner: "QuickDesign" },
    { id: 65, title: "웹사이트 통합 유지보수 서비스", majorCategory: "웹사이트 제작", subCategory: "사이트 유지보수", duration: "상시", price: "₩500,000/월~", rating: 4.9, reviews: 88, tags: ["Maintenance", "Bug Fix", "Updates"], description: "사이트 장애 대응, 보안 패치, 콘텐츠 업데이트를 전담하여 관리해주는 정기 유지보수 서비스입니다.", partner: "WebSupport" },
    { id: 66, title: "포트폴리오 및 퍼스널 브랜딩 웹", majorCategory: "웹사이트 제작", subCategory: "전체", duration: "3주", price: "₩3,500,000~", rating: 4.8, reviews: 45, tags: ["Personal", "Portfolio", "Minimal"], description: "개인 브랜드의 가치를 높여주는 감각적인 포트폴리오 웹사이트 및 자기소개 페이지입니다.", partner: "PersonaWeb" },
    { id: 67, title: "고급 상품 상세 상세 페이지", majorCategory: "웹사이트 제작", subCategory: "상세 페이지", duration: "1주", price: "₩1,500,000~", rating: 4.7, reviews: 67, tags: ["Detail Page", "Copywriting", "Sales"], description: "구매 욕구를 자극하는 설득적인 카피와 압도적인 비주얼이 포함된 프리미엄 상세 페이지입니다.", partner: "SalesVisual" },
    { id: 68, title: "Saas 서비스 소개 랜딩 페이지", majorCategory: "웹사이트 제작", subCategory: "렌딩 페이지", duration: "2주", price: "₩3,000,000~", rating: 4.9, reviews: 53, tags: ["SaaS", "Feature Show", "CTA"], description: "IT 서비스의 핵심 기능을 명확히 전달하고 회원가입을 유도하는 전문 SaaS 랜딩 페이지입니다.", partner: "TechPage" },
    { id: 69, title: "워드프레스 맞춤 테마 제작", majorCategory: "웹사이트 제작", subCategory: "기타", duration: "4주", price: "₩5,000,000~", rating: 4.6, reviews: 39, tags: ["WordPress", "Custom Theme", "CMS"], description: "직접 관리가 용이한 워드프레스 기반으로 고객사가 원하는 기능과 디자인을 구현해 드립니다.", partner: "WPMaster" },
    { id: 70, title: "노션(Notion) 기반 웹 구축", majorCategory: "웹사이트 제작", subCategory: "기타", duration: "1주", price: "₩1,000,000~", rating: 4.8, reviews: 28, tags: ["Notion", "Fast", "Easy Edit"], description: "노션 데이터를 활용하여 빠르고 간편하게 관리할 수 있는 가성비 높은 웹사이트 구축 서비스입니다.", partner: "NotionExpert" },
    { id: 71, title: "웹 접근성 및 표준화 리뉴얼", majorCategory: "웹사이트 제작", subCategory: "사이트 유지보수", duration: "3주", price: "₩4,500,000~", rating: 4.7, reviews: 15, tags: ["Web Standard", "Accessibility", "Renewal"], description: "기존 웹사이트를 웹 표준 및 접근성 지침을 준수하도록 리뉴얼하여 누구나 이용 가능하게 만듭니다.", partner: "WebAccess" },
    { id: 72, title: "모바일 웹 최적화 진단/수정", majorCategory: "웹사이트 제작", subCategory: "사이트 유지보수", duration: "2주", price: "₩2,000,000~", rating: 4.5, reviews: 22, tags: ["Mobile Optimization", "Speed", "UX"], description: "모바일 환경에서 느리고 불편한 웹사이트를 진단하여 속도를 높이고 사용자 경험을 개선합니다.", partner: "MobileFirst" },

    // 7. 마케팅 (12개)
    { id: 73, title: "검색 엔진 최적화(SEO) 마스터", majorCategory: "마케팅", subCategory: "SEO 최적화", duration: "8주", price: "₩5,000,000~", rating: 4.9, reviews: 68, tags: ["SEO", "Organic Search", "Content"], description: "구글 및 네이버 검색 결과 상단 노출을 위한 키워드 분석 및 사이트 최적화 종합 컨설팅입니다.", partner: "SearchMax" },
    { id: 74, title: "마케팅 자동화 시나리오 구축", majorCategory: "마케팅", subCategory: "마케팅 자동화", duration: "4주", price: "₩3,500,000~", rating: 4.8, reviews: 42, tags: ["CRM Marketing", "Automation", "Email"], description: "고객 여정에 따라 자동으로 이메일, 알림톡이 발송되는 효율적인 마케팅 시스템을 구축합니다.", partner: "AutoMarketer" },
    { id: 75, title: "웹사이트 모바일 앱 패키징", majorCategory: "마케팅", subCategory: "앱 패키징", duration: "1주", price: "₩1,500,000~", rating: 4.7, reviews: 91, tags: ["Webview", "App Packing", "Store"], description: "기존 웹사이트를 안드로이드와 iOS 앱으로 패키징하여 스토어에 출시해 드립니다.", partner: "AppPack" },
    { id: 76, title: "디지털 광고 성과 분석 리포트", majorCategory: "마케팅", subCategory: "기타", duration: "2주", price: "₩2,000,000~", rating: 4.8, reviews: 35, tags: ["GA4", "Analytics", "ROAS"], description: "구글 애널리틱스 등을 활용하여 광고 성과를 정밀 분석하고 ROAS 개선 방안을 제시합니다.", partner: "DataAd" },
    { id: 77, title: "그로스 해킹 데이터 트래킹 설계", majorCategory: "마케팅", subCategory: "기타", duration: "3주", price: "₩4,000,000~", rating: 4.9, reviews: 27, tags: ["Growth Hacking", "Tracking", "Funnel"], description: "유입부터 전환까지 모든 고객 행동을 추적할 수 있도록 트래킹 픽셀과 이벤트를 설계합니다.", partner: "GrowthLab" },
    { id: 78, title: "콘텐츠 SEO 기반 블로그 운영", majorCategory: "마케팅", subCategory: "SEO 최적화", duration: "12주", price: "₩3,000,000/월~", rating: 4.7, reviews: 54, tags: ["Content SEO", "Blog", "Inbound"], description: "검색 유입을 유도하는 전문성 있는 칼럼/블로그를 정기적으로 발행하여 인바운드 DB를 확보합니다.", partner: "ContentPower" },
    { id: 79, title: "앱 스토어 최적화(ASO) 패키지", majorCategory: "마케팅", subCategory: "앱 패키징", duration: "2주", price: "₩2,500,000~", rating: 4.8, reviews: 21, tags: ["ASO", "App Store", "Download"], description: "앱 스토어 내 키워드와 이미지를 최적화하여 오가닉 앱 설치 수를 증대시키는 서비스입니다.", partner: "StoreMaster" },
    { id: 80, title: "카카오/메타 광고 자동화 솔루션", majorCategory: "마케팅", subCategory: "마케팅 자동화", duration: "3주", price: "₩4,500,000~", rating: 4.6, reviews: 19, tags: ["SNS Ad", "Automation", "Pixel"], description: "SNS 광고 데이터를 실시간 연동하여 예산 배분을 자동화하고 효율적인 광고 운영을 돕습니다.", partner: "AdRobot" },
    { id: 81, title: "인플루언서 마케팅 플랫폼 연동", majorCategory: "마케팅", subCategory: "기타", duration: "4주", price: "₩6,000,000~", rating: 4.7, reviews: 14, tags: ["Influencer", "Viral", "Platform"], description: "브랜드에 적합한 인플루언서를 매칭하고 캠페인 결과를 한눈에 보는 솔루션 구축 서비스입니다.", partner: "ViralHub" },
    { id: 82, title: "로컬 비즈니스 지도 최적화(MSEO)", majorCategory: "마케팅", subCategory: "SEO 최적화", duration: "4주", price: "₩2,000,000~", rating: 4.8, reviews: 49, tags: ["Local SEO", "Map", "Store"], description: "오프라인 매장이 지도 검색 상단에 노출되도록 정보를 최적화하고 리뷰 관리를 지원합니다.", partner: "LocalSearch" },
    { id: 83, title: "웹사이트 속도 최적화 패키지", majorCategory: "마케팅", subCategory: "기타", duration: "2주", price: "₩3,000,000~", rating: 4.9, reviews: 33, tags: ["Lighthouse", "Speed", "SEO"], description: "검색 순위에 큰 영향을 미치는 사이트 로딩 속도를 분석하고 90점 이상의 성과를 보장합니다.", partner: "SpeedUp" },
    { id: 84, title: "앱 알림(Push) 캠페인 자동화", majorCategory: "마케팅", subCategory: "마케팅 자동화", duration: "3주", price: "₩2,800,000~", rating: 4.7, reviews: 26, tags: ["Push", "Retention", "Automation"], description: "유저의 특정 행동 발생 시 즉각적으로 푸시 알림을 발송하여 앱 재방문율을 높이는 시스템입니다.", partner: "PushMaster" },
];

/* --- English translations for solution cards --- */
const SOLUTION_EN = {
  1:  { title: "Data-Driven Recruitment Matching Platform",   description: "An intelligent recruitment matching system considering AI-based job competency analysis and cultural fit." },
  2:  { title: "PropTech Real Estate Brokerage System",       description: "Provides blockchain-based real estate transaction transparency with 3D virtual tours and AI price predictions." },
  3:  { title: "Telemedicine Matching Platform",              description: "A remote healthcare matching solution combining HIPAA-compliant video consultation with AI symptom analysis." },
  4:  { title: "Used Car Trading Brokerage Solution",         description: "A used car trading solution integrating reliable vehicle inspection data and a real-time auction system." },
  5:  { title: "Pet Care Matching Service",                   description: "A pet care platform connecting verified pet sitters with owners and sharing real-time walking routes." },
  6:  { title: "Construction Workforce Matching Platform",    description: "A system matching construction site labor demand with workers in real time and automating workforce management." },
  7:  { title: "Ad Media Brokerage Solution",                 description: "A platform connecting advertisers with media outlets to bid for optimal ad placements and analyze performance." },
  8:  { title: "Travel Guide Matching System",                description: "A themed travel brokerage solution matching local guides with travelers based on personal preferences." },
  9:  { title: "Professional Outsourcing Platform",           description: "A system safely brokering outsourcing contracts between professional freelancers and companies with payment protection." },
  10: { title: "Secure Secondhand Trading Platform",          description: "A safe location-based secondhand trading platform integrating AI fraud detection with escrow payment." },
  11: { title: "After-School Education Matching Platform",    description: "A system analyzing students' learning levels and styles to recommend the best instructors and educational content." },
  12: { title: "Digital Content Marketplace",                 description: "A content brokerage platform for safely trading creators' digital works and managing royalties." },
  13: { title: "LMS-Based Online Course Solution",            description: "A customizable lecture platform with stable video streaming and progress tracking." },
  14: { title: "Intelligent POS Payment System",              description: "A smart POS system integrating offline store payments, inventory management, and sales analysis." },
  15: { title: "Smart Unmanned Kiosk Solution",               description: "An unmanned ordering and guidance kiosk solution with intuitive UI supporting various payment methods." },
  16: { title: "Server Monitoring & Control System",          description: "A control system for real-time monitoring of large-scale server infrastructure and early fault detection." },
  17: { title: "Digital Asset Wallet & Management Solution",  description: "A digital asset storage and transaction management system with bank-level security technology." },
  18: { title: "Enterprise Messenger & Collaboration Tool",   description: "A private internal messenger and document collaboration tool with enhanced data security." },
  19: { title: "Smart Factory Monitoring Platform",           description: "A monitoring system collecting IoT data from factory equipment to visualize utilization rates in real time." },
  20: { title: "Cryptocurrency Exchange Platform Build",      description: "A high-performance exchange solution with a matching engine processing tens of thousands of transactions per second." },
  21: { title: "Custom Learning Management System (LMS)",     description: "A feature-rich learning management platform specialized for corporate training or certification exam preparation." },
  22: { title: "Fleet Management System (FMS)",               description: "A fleet control system for real-time management of corporate vehicles to reduce maintenance costs." },
  23: { title: "STB & IPTV Service Platform",                 description: "A backend and UI construction solution for media streaming and VOD services based on set-top boxes." },
  24: { title: "Franchise Integrated POS Management",         description: "A POS solution for managing hundreds of franchises and synchronizing data between headquarters and stores." },
  25: { title: "Cloud-Based Custom ERP",                      description: "A cloud ERP solution for SMEs integrating production, inventory, and accounting management." },
  26: { title: "Data-Driven CRM Customer Management",         description: "A CRM solution analyzing customer behavior data to enable marketing automation and sales opportunity discovery." },
  27: { title: "Smart Manufacturing Execution System (MES)",  description: "A manufacturing execution system optimizing real-time monitoring and defect rate management for production processes." },
  28: { title: "Enterprise Project Management System (PMS)",  description: "An enterprise-grade PMS for integrated management of schedules, human resources, and budgets for large projects." },
  29: { title: "Integrated Logistics & Warehouse Management", description: "A solution automating the entire logistics process from receiving to shipping and maximizing inventory accuracy." },
  30: { title: "Business Intelligence Data Analytics",        description: "A solution collecting scattered data and visualizing key metrics needed for decision-making in a dashboard." },
  31: { title: "HR & Attendance Management System",           description: "A system automating flexible work arrangements and complex payroll calculations to improve HR efficiency." },
  32: { title: "Sales Force Automation (SFA) System",         description: "A sales automation solution systematizing the entire sales process from activity recording to contract management." },
  33: { title: "Advanced Planning & Scheduling (APS)",        description: "An AI-based optimization scheduling system for maximizing production efficiency within resource constraints." },
  34: { title: "Cost Management & Analysis System",           description: "A system providing detailed product cost calculation and profitability analysis to support management strategy." },
  35: { title: "Electronic Document Management (EDMS)",       description: "A system for digitizing all important company documents and securely sharing/storing them by access permission." },
  36: { title: "Real-Time Supply Chain Management (SCM)",     description: "A solution managing supply chain risks through real-time data sync with suppliers and maintaining optimal inventory." },
  37: { title: "LLM-Based Enterprise Chatbot Service",        description: "An intelligent in-house chatbot system trained on company documents to provide accurate answers." },
  38: { title: "Image-Based Product Defect Detection AI",     description: "A solution using deep learning to automatically detect minute product defects on manufacturing lines." },
  39: { title: "Generative AI Content Creation Tool",         description: "An AI service that automatically generates high-quality promotional images and copywriting from text input alone." },
  40: { title: "Time Series Data Prediction Analytics",       description: "A machine learning engine that precisely forecasts future sales, inventory demand, etc. based on historical data." },
  41: { title: "Voice Recognition & Consultation Analysis AI",description: "A system converting call center conversations to text and analyzing customer emotions and key keywords." },
  42: { title: "Custom Recommendation Algorithm Build",       description: "A personalization engine analyzing user behavior logs to recommend products with the highest purchase probability." },
  43: { title: "Multilingual Real-Time Translation Chatbot",  description: "A customer service chatbot with real-time translation enabling global customers to communicate in their native language." },
  44: { title: "AI Document Auto-Classification/Summarization",description: "A solution automatically classifying thousands of documents by topic and summarizing key content in one sentence." },
  45: { title: "Financial Fraud Detection AI",                description: "An advanced AI model detecting abnormal payment patterns in real time to prevent financial incidents." },
  46: { title: "Virtual Human Avatar Generation Engine",      description: "Technology for creating videos of virtual avatars that closely resemble real people, speaking and moving naturally." },
  47: { title: "AI Data Labeling Automation Tool",            description: "A tool reducing data preparation time for ML training by having AI perform initial labeling." },
  48: { title: "Autonomous Obstacle Recognition System",      description: "A robot and autonomous driving AI model recognizing surrounding objects and calculating distances to prevent collisions." },
  49: { title: "Multi-Channel Open Mall Platform",            description: "An advanced open marketplace solution allowing multiple vendors to join and sell products." },
  50: { title: "Premium Brand Direct-to-Consumer Mall",       description: "A high-quality D2C shopping mall with sophisticated brand-aligned design and fast performance." },
  51: { title: "Live Commerce Integrated Solution",           description: "An interactive live shopping platform for selling products through live broadcasts and real-time chat." },
  52: { title: "Global Cross-Border Shopping Mall",           description: "A commerce platform for global markets with overseas payment, multilingual support, and international logistics." },
  53: { title: "Subscription Commerce System",               description: "A subscription business solution supporting recurring automatic payments and regular delivery management." },
  54: { title: "Food & Beverage O2O Order App",               description: "A mobile commerce app solution for F&B businesses with takeout reservation and delivery ordering." },
  55: { title: "B2B Private Employee Welfare Mall",           description: "A closed welfare mall and point payment system accessible only to employees of specific companies." },
  56: { title: "Social Commerce & Group Buying Tool",         description: "A market specialized in group buying and social sharing where users invite friends to receive discounts." },
  57: { title: "Unmanned Smart Commerce Store",               description: "An unmanned store operation and management solution with QR payment and inventory sensors integrated." },
  58: { title: "Beauty/Fashion Visual Commerce",              description: "A stylish fashion/beauty shopping mall emphasizing high-resolution images and lookbook-style grids." },
  59: { title: "Commission Settlement & Partner Center",      description: "A commerce back-office solution automating complex sales commission calculations and per-partner settlements." },
  60: { title: "Pre-Owned Luxury Consignment Platform",       description: "A premium secondhand luxury goods trading platform including appraisal evaluation and consignment processes." },
  61: { title: "High-Conversion Landing Page Package",        description: "A landing page creation and A/B test support service designed to maximize marketing performance." },
  62: { title: "Premium Corporate Branding Website",          description: "A sophisticated corporate website with refined design and complete SEO to enhance company credibility." },
  63: { title: "Responsive Web Design & Publishing",          description: "Responsive website creation that works perfectly across all devices from PC to mobile." },
  64: { title: "Event/Promotion Detail Page",                 description: "Event and promotion detail pages designed to generate intense attention quickly." },
  65: { title: "Website Integrated Maintenance Service",      description: "A regular maintenance service managing site failures, security patches, and content updates." },
  66: { title: "Portfolio & Personal Branding Website",       description: "A stylish portfolio website and personal introduction page that enhances individual brand value." },
  67: { title: "Premium Product Detail Page",                 description: "A premium detail page with persuasive copy stimulating purchase desire and outstanding visuals." },
  68: { title: "SaaS Service Introduction Landing Page",      description: "A professional SaaS landing page that clearly conveys key features of IT services and drives sign-ups." },
  69: { title: "WordPress Custom Theme Development",          description: "WordPress-based implementation of functions and design requested by clients, easy to manage independently." },
  70: { title: "Notion-Based Website Build",                  description: "A cost-effective website build service utilizing Notion data for fast and easy management." },
  71: { title: "Web Accessibility & Standards Renewal",       description: "Renewing existing websites to comply with web standards and accessibility guidelines for all users." },
  72: { title: "Mobile Web Optimization Diagnosis/Fix",       description: "Diagnosing slow and inconvenient mobile websites to improve loading speed and user experience." },
  73: { title: "Search Engine Optimization (SEO) Master",     description: "Comprehensive keyword analysis and site optimization consulting for top ranking in Google and Naver search." },
  74: { title: "Marketing Automation Scenario Build",         description: "An efficient marketing system that automatically sends emails and notifications based on the customer journey." },
  75: { title: "Website Mobile App Packaging",                description: "A service packaging your existing website into Android and iOS apps and submitting them to stores." },
  76: { title: "Digital Advertising Performance Analysis",    description: "Using Google Analytics to precisely analyze ad performance and suggest ROAS improvement plans." },
  77: { title: "Growth Hacking Data Tracking Design",         description: "Designing tracking pixels and events to track all customer behaviors from inflow to conversion." },
  78: { title: "Content SEO-Based Blog Operations",           description: "Regularly publishing expert columns/blogs to drive search traffic and secure inbound leads." },
  79: { title: "App Store Optimization (ASO) Package",        description: "A service optimizing keywords and images in app stores to increase organic app installations." },
  80: { title: "Kakao/Meta Ad Automation Solution",           description: "Automating budget allocation by connecting SNS ad data in real time for efficient ad management." },
  81: { title: "Influencer Marketing Platform Integration",   description: "A solution build service matching brands with suitable influencers and viewing campaign results at a glance." },
  82: { title: "Local Business Map Optimization (MSEO)",      description: "Optimizing information so offline stores appear at the top of map searches and supporting review management." },
  83: { title: "Website Speed Optimization Package",          description: "Analyzing site loading speed — a major search ranking factor — and guaranteeing a score of 90+." },
  84: { title: "App Push Campaign Automation",                description: "A system sending immediate push notifications upon specific user actions to increase app revisit rates." },
};

function SolutionCard({ solution, isBookmarked, onBookmarkToggle, onClick }) {
    const [hovered, setHovered] = useState(false);
    const [isAnimate, setIsAnimate] = useState(false);
    const { t, lang } = useLanguage();

    const enData = SOLUTION_EN[solution.id];
    const displayTitle = lang !== "ko" && enData ? enData.title : solution.title;
    const displayDesc  = lang !== "ko" && enData ? enData.description : solution.description;

    const handleBookmarkClick = (e) => {
        e.stopPropagation();
        setIsAnimate(true);
        onBookmarkToggle(solution.id);
        setTimeout(() => setIsAnimate(false), 400);
    };

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: "white",
                borderRadius: 20,
                border: hovered ? "1.5px solid #3b82f6" : "1.5px solid #F3F4F6",
                padding: "24px",
                cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: hovered ? "0 8px 32px rgba(59,130,246,0.12)" : "0 2px 8px rgba(0,0,0,0.05)",
                transform: hovered ? "translateY(-4px)" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontFamily: F,
                position: "relative",
                height: "100%", // 카드 높이 균일화
                boxSizing: "border-box"
            }}
        >
            {/* 상단: 카테고리 + 북마크 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#004ac6", fontWeight: 700 }}>
                    {SUB_KEY_MAP[solution.subCategory]
                        ? t(`solutionMarket.subCategories.${SUB_KEY_MAP[solution.subCategory]}`)
                        : solution.subCategory}
                </span>
                <div 
                    onClick={handleBookmarkClick}
                    style={{
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
                        transform: isAnimate ? "scale(1.4)" : "scale(1)",
                    }}
                >
                    <Bookmark 
                        size={20} 
                        fill={isBookmarked ? "#2563EB" : "none"} 
                        color={isBookmarked ? "#2563EB" : "#9CA3AF"} 
                        strokeWidth={isBookmarked ? 0 : 2}
                    />
                </div>
            </div>

            {/* 제목 */}
            <h3 style={{
                fontSize: 18, fontWeight: 800, color: "#111827", margin: 0, lineHeight: 1.4,
                fontFamily: FH,
            }}>
                {displayTitle}
            </h3>

            {/* 설명 */}
            <p style={{
                fontSize: 14, color: "#6B7280", margin: 0,
                lineHeight: 1.6, flexGrow: 1,
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden",
            }}>
                {displayDesc}
            </p>

            {/* 태그 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {solution.tags.map(tag => (
                    <span key={tag} style={{
                        fontSize: 11, background: "#F3F4F6", color: "#374151",
                        padding: "3px 8px", borderRadius: 6, fontWeight: 600,
                    }}>
                        #{tag}
                    </span>
                ))}
            </div>

            {/* 구분선 */}
            <div style={{ borderTop: "1px solid #F3F4F6", margin: "4px 0" }} />

            {/* 하단 정보 */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* 별점 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Star size={14} fill="#F59E0B" color="#F59E0B" />
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{solution.rating}</span>
                        <span style={{ fontSize: 12, color: "#9CA3AF" }}>({solution.reviews})</span>
                    </div>
                    {/* 납기 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                        <Clock size={14} color="#9CA3AF" />
                        <span style={{ fontSize: 13, color: "#6B7280" }}>{solution.duration}</span>
                    </div>
                </div>
                {/* 가격 */}
                <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>
                    {solution.price}
                </span>
            </div>

            {/* 파트너 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "linear-gradient(135deg, #60a5fa, #6366f1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                    <Award size={14} color="white" />
                </div>
                <span style={{ fontSize: 13, color: "#4B5563", fontWeight: 600 }}>{solution.partner}</span>
            </div>
        </div>
    );
}

export default function SolutionMarket() {
    const navigate = useNavigate();
    const { t, lang: _lang } = useLanguage();
    const [activeCategory, setActiveCategory] = useState("중개 플랫폼");
    const [activeSubCategory, setActiveSubCategory] = useState("전체");
    const [searchQuery] = useState("");
    const [bookmarked, setBookmarked] = useState({});
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const subCats = SUB_CATEGORIES[activeCategory] || ["전체"];

    // 필터링
    const filtered = SOLUTIONS.filter((s) => {
        if (s.majorCategory !== activeCategory) return false;
        if (activeSubCategory !== "전체" && s.subCategory !== activeSubCategory) return false;
        if (searchQuery && !s.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
    });

    // 페이지네이션 계산
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedSolutions = filtered.slice(startIndex, startIndex + itemsPerPage);

    const toggleBookmark = (id) => {
        setBookmarked((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div style={{ fontFamily: F, background: "#f7f9fb", minHeight: "100vh" }}>
            <AppHeader />
            {/* Hero Section */}
            <section style={{
                background: `linear-gradient(135deg, rgba(0,0,0,0.01) 0%, rgba(0,0,0,0.01) 100%), url(${home3Img}) center/cover no-repeat`,
                padding: "32px 24px 28px",
                textAlign: "center",
            }}>
                <div style={{
                    maxWidth: 980,
                    margin: "0 auto",
                    background: "rgba(255,255,255,0.42)",
                    border: "1px solid rgba(255,255,255,0.68)",
                    borderRadius: 20,
                    padding: "24px 22px 20px",
                    boxShadow: "0 10px 30px rgba(15,23,42,0.10)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                }}>

                    <h1 style={{
                        fontFamily: FH,
                        fontSize: 32, fontWeight: 900, color: "#0F172A", margin: "0 0 10px", letterSpacing: -0.5,
                    }}>
                        {t("solutionMarket.heroTitle")}
                    </h1>
                    <p style={{ color: "#334155", fontSize: 14, marginBottom: 22, maxWidth: 460, marginLeft: "auto", marginRight: "auto", fontWeight: 600 }}>
                        {t("solutionMarket.heroSubtitle")}
                    </p>

                    {/* Stats */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 22, flexWrap: "wrap" }}>
                        {[
                            { label: t("solutionMarket.statSolutions"), value: "320+", icon: "🟰" },
                            { label: t("solutionMarket.statPartners"), value: "180+", icon: "🤝" },
                            { label: t("solutionMarket.statRating"), value: "4.8", icon: "⭐" },
                        ].map(stat => (
                            <div key={stat.label} style={{
                                width: 200,
                                textAlign: "center",
                                background: "rgba(255,255,255,0.62)",
                                border: "1px solid rgba(148,163,184,0.34)",
                                borderRadius: 16,
                                padding: "14px 16px 12px",
                                boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
                                backdropFilter: "blur(6px)",
                                WebkitBackdropFilter: "blur(6px)",
                            }}>
                                <div style={{ fontSize: 34, lineHeight: 1, fontWeight: 900, fontFamily: FH, color: "#334155" }}>{stat.value}</div>
                                <div style={{ fontSize: 13, color: "#1E293B", marginTop: 6, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                                    {stat.label}<span style={{ fontSize: 14 }}>{stat.icon}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Category Tabs */}
            <div style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px" }}>
                <div
                    className="hide-scrollbar"
                    style={{
                        display: "flex", gap: 0, overflowX: "auto",
                        borderBottom: "1px solid #E5E7EB", paddingTop: 8,
                        justifyContent: "center",
                    }}>
                    {CATEGORY_KO.map((cat) => (
                        <button
                            key={cat}
                            onClick={() => { setActiveCategory(cat); setActiveSubCategory("전체"); setCurrentPage(1); }}
                            style={{
                                padding: "12px 12px", fontSize: 13, fontWeight: activeCategory === cat ? 700 : 500,
                                color: activeCategory === cat ? "#004ac6" : "#6B7280",
                                borderBottom: activeCategory === cat ? "2px solid #004ac6" : "2px solid transparent",
                                background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap",
                                borderBottomWidth: 2, borderBottomStyle: "solid",
                                borderBottomColor: activeCategory === cat ? "#004ac6" : "transparent",
                                fontFamily: F,
                            }}
                        >
                            {t(`solutionMarket.categories.${CAT_KEY_MAP[cat]}`)}
                        </button>
                    ))}
                </div>

                {/* Sub-category Pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "16px 0" }}>
                    {subCats.map((sub) => (
                        <button
                            key={sub}
                            onClick={() => { setActiveSubCategory(sub); setCurrentPage(1); }}
                            style={{
                                padding: "8px 18px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                                cursor: "pointer", border: "1px solid",
                                fontFamily: F,
                                ...(activeSubCategory === sub
                                    ? { background: "#004ac6", color: "white", borderColor: "#004ac6" }
                                    : { background: "linear-gradient(135deg, #EFF6FF, #F5F3FF)", color: "#6366F1", borderColor: "#C7D2FE" }),
                            }}
                        >
                            {SUB_KEY_MAP[sub] ? t(`solutionMarket.subCategories.${SUB_KEY_MAP[sub]}`) : sub}
                        </button>
                    ))}
                </div>

                {/* Solution Cards Grid */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                    gap: 24,
                    paddingBottom: 60,
                    paddingTop: 8
                }}>
                    {paginatedSolutions.map((solution) => (
                        <SolutionCard
                            key={solution.id}
                            solution={solution}
                            isBookmarked={!!bookmarked[solution.id]}
                            onBookmarkToggle={toggleBookmark}
                            onClick={() => navigate("/solution_detail")}
                        />
                    ))}

                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: "80px 0", color: "#9CA3AF", gridColumn: "1 / -1" }}>
                            {t("solutionMarket.noResult")}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 0 && (
                    <div style={{ display: "flex", justifyContent: "center", gap: 8, paddingBottom: 60 }}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                style={{
                                    width: 40, height: 40, borderRadius: 10, border: "none",
                                    fontSize: 14, fontWeight: 600, cursor: "pointer",
                                    fontFamily: F,
                                    transition: "all 0.2s",
                                    ...(page === currentPage
                                        ? { background: "#004ac6", color: "white", boxShadow: "0 4px 12px rgba(0,74,198,0.2)" }
                                        : { background: "white", color: "#6B7280", border: "1px solid #E5E7EB" }),
                                }}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                )}

                {/* Partner Registration CTA */}
                <div style={{
                    marginTop: 0,
                    marginBottom: 60,
                    background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
                    border: "1px solid #DBEAFE",
                    borderRadius: 24,
                    padding: "40px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 24,
                }}>
                    <div>
                        <h3 style={{ fontSize: 22, fontWeight: 800, color: "#1E3A5F", margin: "0 0 8px", fontFamily: FH }}>
                            {t("solutionMarket.partnerCta.title")}
                        </h3>
                        <p style={{ fontSize: 15, color: "#6B7280", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>
                            {t("solutionMarket.partnerCta.desc")}
                        </p>
                    </div>
                    <button style={{
                        padding: "16px 32px",
                        background: "linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #6366f1 100%)",
                        color: "white", border: "none",
                        borderRadius: 14, fontSize: 16, fontWeight: 700,
                        cursor: "pointer", fontFamily: F,
                        display: "flex", alignItems: "center", gap: 8,
                        whiteSpace: "nowrap",
                        boxShadow: "0 4px 14px rgba(59,130,246,0.3)",
                    }}>
                        {t("solutionMarket.partnerCta.btn")}
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
