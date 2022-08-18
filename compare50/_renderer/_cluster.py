import collections

class Cluster:
    def __init__(self, sub_pair_to_results):
        self._sub_pair_to_results = sub_pair_to_results
        self.links = [[a, b, index] for index, (a, b) in enumerate(sub_pair_to_results.keys())]

        self.submissions = set()
        for sub_a, sub_b in sub_pair_to_results:
            self.submissions.add(sub_a)
            self.submissions.add(sub_b)
    

    def submissions_as_dict(self):
        return {sub.id: {
            "id": sub.id,
            "path": str(sub.path) if hasattr(sub, "path") else sub.submitter,
            "isArchive": sub.is_archive
        } for sub in self.submissions}


    def links_as_dict(self):
        max_score = max((results[0].score.score for results in self._sub_pair_to_results.values()))
        normalize_score = lambda score: score / max_score * 10

        links = []

        for (sub_a, sub_b, index) in self.links:
            results = self._sub_pair_to_results[(sub_a, sub_b)]
            score = results[0].score.score

            links.append({
                "index": index + 1,
                "submissionIdA": sub_a.id,
                "submissionIdB": sub_b.id,
                "score": score,
                "normalized_score": normalize_score(score),
            })

        return links


    def get_subcluster(self, submission):
        """Get the cluster of submissions directly or indirectly linked with submission"""

        # Build a dict to quickly access links from either end
        links_dict = collections.defaultdict(list)
        for a, b, index in self.links:
            links_dict[a].append(b)
            links_dict[b].append(a)

        # Build the cluster with Depth-First-Search
        cluster_links = set()
        seen_subs = {submission}
        untraversed_subs = [submission]
        while untraversed_subs:
            untraversed_sub = untraversed_subs.pop()
            
            for sub in links_dict[untraversed_sub]:
                if sub not in seen_subs:
                    seen_subs.add(sub)
                    untraversed_subs.append(sub)
                
                cluster_links.add((untraversed_sub, sub))

        # Build the cluster, each original link + its result
        cluster = {}
        for link in cluster_links:
            if link in self._sub_pair_to_results:
                cluster[link] = self._sub_pair_to_results[link]
        
        new_cluster = Cluster(cluster)

        # Use the link index of this cluster
        for link in new_cluster.links:
            index = [index for a, b, index in self.links if a == link[0] and b == link[1]][0]
            link[2] = index

        return new_cluster