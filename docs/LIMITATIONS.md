# Free Tier Service Limitations

## Overview
This document outlines the free tier limits for all services used by United Album. Understanding these limits helps ensure the application remains within free tier quotas and avoid unexpected costs.

---

## 1. Google Cloud Platform (GCP) Free Tier

### Google Drive API
- **Storage**: 15 GB shared across Gmail, Drive, Photos (per Google account)
- **API Calls**:
  - 1,000 queries per day per user
  - 10 queries per second per user
- **Bandwidth**: No specific limit (part of general GCP free tier)
- **Cost After Limit**: $0.40/GB for additional storage

### Gmail (if used for notifications)
- **Storage**: 15 GB (shared with Drive and Photos)
- **Sending Limit**: 500 recipients per day
- **API Calls**: 1 billion quota units per day

### Google OAuth 2.0
- **Free**: Unlimited OAuth authentications
- **Rate Limit**: 10,000 requests per day per project
- **No Cost**: OAuth service is completely free

**Documentation**: https://cloud.google.com/free

---

## 2. Vercel Free Tier (Hobby Plan)

### Hosting & Deployment
- **Bandwidth**: 100 GB/month
- **Serverless Function Execution**: 100 GB-hours/month
- **Build Minutes**: 6,000 minutes/month
- **Deployments**: Unlimited
- **Team Members**: 1 (Hobby plan)
- **Edge Network**: Global CDN included

### Vercel Postgres (Hobby Plan)
- **Storage**: 256 MB
- **Compute**: 60 hours/month
- **Data Transfer**: 256 MB/month
- **Max Database Size**: 256 MB
- **Max Connections**: 60 concurrent connections
- **Cost After Limit**:
  - Storage: $0.10/GB
  - Data Transfer: $0.10/GB

**Estimated Wedding Usage**:
| Resource | Estimate (500 photos, 50 people) | % of Free Tier |
|----------|----------------------------------|----------------|
| Database Storage | ~1 MB (metadata only) | < 1% |
| Compute Hours | 5-10 hours | 8-17% |
| Data Transfer | 5-10 MB | 2-4% |

**Documentation**: https://vercel.com/docs/pricing

---

## 3. Next.js (Framework)
- **Free**: Open source framework
- **No Limits**: Unlimited builds, deployments
- **Cost**: $0 (hosting platform limits apply)

**Documentation**: https://nextjs.org/

---

## 4. Prisma ORM
- **Free**: Open source
- **No Limits**: Unlimited database connections (database platform limits apply)
- **Cost**: $0

**Documentation**: https://www.prisma.io/pricing

---

## 5. Google Drive Storage (User Account)
- **Free Storage**: 15 GB shared with Gmail and Photos
- **Upgrade Options**:
  - 100 GB: $1.99/month
  - 200 GB: $2.99/month
  - 2 TB: $9.99/month

**Photo Storage**: All uploaded wedding photos are stored in Google Drive, not in the database. Photos are the main storage consumer.

---

## Estimated Usage for Typical Wedding Event

### Scenario: 500 guests, 500 photos uploaded

| Service | Resource | Est. Usage | Free Tier Limit | Utilization | Risk Level |
|---------|----------|------------|-----------------|-------------|------------|
| **GCP Drive API** | API Calls | 2,000-5,000/day | 1,000/day per user | 200-500% | ⚠️ **MAY EXCEED** |
| **GCP Drive** | Storage | 2-5 GB | 15 GB | 13-33% | ✅ Safe |
| **Vercel** | Bandwidth | 10-20 GB/month | 100 GB | 10-20% | ✅ Safe |
| **Vercel** | Function Exec | 5-10 GB-hrs | 100 GB-hrs | 5-10% | ✅ Safe |
| **Vercel Postgres** | Storage | ~1 MB | 256 MB | < 1% | ✅ Safe |
| **Vercel Postgres** | Compute | 5-10 hrs | 60 hrs | 8-17% | ✅ Safe |

**Total Estimated Cost**: $0/month (within free tiers, except possible Drive API limit)

### API Call Mitigation

The Drive API limit is the main concern. To stay within limits:
- **Solution 1**: Use service account with multiple user quotas
- **Solution 2**: Implement caching to reduce API calls
- **Solution 3**: Batch operations where possible
- **Solution 4**: Upgrade to paid Google Workspace if needed ($6-12/month)

---

## Monitoring & Alerts

### Vercel Dashboard
1. Go to **Project** → **Analytics** → **Usage**
2. Monitor:
   - Bandwidth consumption
   - Function execution time
   - Database storage size
   - Build minutes used

### Google Cloud Console
1. Go to **APIs & Services** → **Dashboard**
2. Monitor:
   - Drive API quota usage
   - Daily quota remaining
   - Spike alerts

### Recommended Monitoring Schedule
- **During Wedding Event**: Check daily
- **Post-Event**: Check weekly for first month
- **Ongoing**: Check monthly

---

## When to Upgrade

### Vercel Pro Plan ($20/month)
**Upgrade When**:
- Bandwidth exceeds 80 GB/month
- Need team collaboration (multiple admins)
- Want priority support
- Need custom domains with SSL

**Benefits**:
- 1 TB bandwidth
- Unlimited team members
- Advanced analytics
- Priority support

### Google Workspace ($6-12/month per user)
**Upgrade When**:
- Drive storage exceeds 10 GB
- Need custom domain email (@yourwedding.com)
- Want advanced admin controls
- Need higher API quotas

**Benefits**:
- 30 GB - 2 TB storage per user
- Higher API quotas
- Enhanced security features
- Business email

### Vercel Postgres Upgrade
**Upgrade When**:
- Database approaches 200 MB (80% of 256 MB)
- Need more than 60 concurrent connections
- Compute hours exceed 50/month

**Note**: For this application, database upgrade is unlikely. Photos are in Drive, database only stores metadata.

---

## Cost Projections

### Small Wedding (100 guests, 200 photos)
- **Total Cost**: $0/month
- **Risk**: None
- **Action**: No upgrade needed

### Medium Wedding (250 guests, 400 photos)
- **Total Cost**: $0/month
- **Risk**: Low
- **Action**: Monitor Drive API calls

### Large Wedding (500+ guests, 1000+ photos)
- **Total Cost**: $6-20/month
- **Risk**: Medium (Drive API, Vercel bandwidth)
- **Action**: Consider Google Workspace + Vercel Pro

---

## Best Practices to Stay Within Limits

### 1. Image Compression
- Server-side compression to < 5 MB per photo
- Reduces Drive storage and bandwidth
- Already implemented in current version

### 2. Lazy Loading
- Load images only when visible
- Infinite scroll pagination (20 photos at a time)
- Already implemented

### 3. Caching
- Browser cache: 1 year for images (`Cache-Control: immutable`)
- Reduces Drive API calls
- Already implemented

### 4. Batch Operations
- Download multiple photos as ZIP (max 50)
- Reduces individual API calls
- Already implemented

### 5. Database Optimization
- Denormalized like counts (avoid JOIN queries)
- Indexed frequently queried fields
- Already implemented

---

## Emergency Actions if Limits Exceeded

### If Drive API Quota Exceeded
1. **Immediate**: Application shows cached photos only
2. **Short-term**: Increase quota via Google Cloud Console
3. **Long-term**: Upgrade to Google Workspace

### If Vercel Bandwidth Exceeded
1. **Immediate**: Service continues (Vercel doesn't hard-stop)
2. **Short-term**: Optimize image sizes
3. **Long-term**: Upgrade to Vercel Pro

### If Database Full
1. **Immediate**: Remove orphaned face records
2. **Short-term**: Delete old/unused photos
3. **Long-term**: Unlikely to occur with current usage

---

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Google Cloud Support**: https://cloud.google.com/support
- **Prisma Documentation**: https://www.prisma.io/docs

---

*Last Updated: 2026-01-19*
*Review Quarterly or Before Large Events*
