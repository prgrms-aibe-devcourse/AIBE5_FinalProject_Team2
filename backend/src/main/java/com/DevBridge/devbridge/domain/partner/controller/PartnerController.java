package com.DevBridge.devbridge.domain.partner.controller;

import com.DevBridge.devbridge.domain.partner.dto.PartnerSummaryResponse;
import com.DevBridge.devbridge.domain.partner.service.PartnerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/partners")
@RequiredArgsConstructor
public class PartnerController {

    private final PartnerService partnerService;

    /**
     * 파트너 목록. SQL-level 페이지네이션 — limit/offset/sort 만큼만 DB 에서 조회.
     * 기본 최신순 20개. 클라이언트 필터링이 필요하면 ?limit=999 로 전체 조회.
     */
    @GetMapping
    public List<PartnerSummaryResponse> list(
            @RequestParam(value = "limit",  defaultValue = "20") int limit,
            @RequestParam(value = "offset", defaultValue = "0")  int offset,
            @RequestParam(value = "sort",   defaultValue = "latest") String sort) {
        return partnerService.findPage(limit, offset, sort);
    }

    /** 파트너 상세 (id = partner_profile.id) */
    @GetMapping("/{id}")
    public ResponseEntity<PartnerSummaryResponse> detail(@PathVariable Long id) {
        try {
            return ResponseEntity.ok(partnerService.findById(id));
        } catch (RuntimeException e) {
            return ResponseEntity.notFound().build();
        }
    }
}

