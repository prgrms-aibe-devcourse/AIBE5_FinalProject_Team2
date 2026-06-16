-- 주문 제안에 종목명 컬럼 추가 (종목코드만으로는 식별이 어려운 국내주식 대응)
ALTER TABLE order_proposal ADD COLUMN stock_name VARCHAR(100);
