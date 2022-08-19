var d3 = require("d3");

const IN_DEVELOPMENT = process.env.NODE_ENV === "development";

class API {
    static placeHolderMatch() {
        return new Match(
            [
                {
                    name: "...",
                    files: [],
                    id: -1,
                    isArchive: false,
                },
                {
                    name: "...",
                    files: [],
                    id: -2,
                    isArchive: false,
                },
            ],
            [],
            {
                index: -1,
                numberOfMatches: -1,
            }
        );
    }

    static async getMatch(index) {
        // In development use mock data
        if (IN_DEVELOPMENT) {
            return await Promise.all([
                import("./mock_data/sub_a.json"),
                import("./mock_data/sub_b.json"),
                import("./mock_data/pass_structure.json"),
                import("./mock_data/pass_text.json"),
                import("./mock_data/pass_exact.json"),
                import("./mock_data/pass_names.json"),
                import("./mock_data/match_metadata.json"),
            ]).then(
                ([
                    subA,
                    subB,
                    passStructure,
                    passText,
                    passExact,
                    passNames,
                    metadata,
                ]) => {
                    return new Match(
                        [subA, subB],
                        [passStructure, passText, passExact, passNames],
                        metadata
                    );
                }
            );
        }

        // In production use static data attached to the window by compare50
        const { SUB_A, SUB_B, PASSES, METADATA } =
            window.COMPARE50.MATCHES[index];

        const subs = [SUB_A];
        if (SUB_B !== undefined) {
            subs.push(SUB_B);
        }

        return new Match(subs, PASSES, METADATA);
    }

    static async getGraph(index) {
        // In development use mock data
        if (IN_DEVELOPMENT) {
            return await Promise.all([
                import("./mock_data/home_links.json"),
                import("./mock_data/home_submissions.json"),
            ]).then(([links, submissions]) => {
                return new Graph(
                    links.default,
                    submissions.default
                ).inD3Format();
            });
        }

        if (index == null) {
            const { LINKS, SUBMISSIONS } = window.COMPARE50;
            return new Graph(LINKS, SUBMISSIONS).inD3Format();
        }

        const { LINKS, SUBMISSIONS } = window.COMPARE50.MATCHES[index];

        // In production use static data attached to the window by compare50
        return new Graph(LINKS, SUBMISSIONS).inD3Format();
    }
}

class Match {
    constructor(subs, passes, metadata) {
        this.submissions = subs;
        this.passes = passes;
        this.metadata = metadata;
    }

    getPass(pass) {
        return this.passes.find((p) => p.name === pass.name);
    }

    index() {
        return this.metadata.index;
    }

    numberOfMatches() {
        return this.metadata.numberOfMatches;
    }
}

class Graph {
    constructor(links, submissions) {
        this.links = links;
        this.submissions = submissions;
        this._assignGroups();
    }

    inD3Format() {
        const d3Format = {};

        // Create links field
        d3Format["links"] = this.links.map((link, i) => {
            return {
                index: i,
                link_index: link.index,
                nodeAId: this.submissions[link.submissionIdA].id,
                nodeBId: this.submissions[link.submissionIdB].id,
                source: this.submissions[link.submissionIdA].id, // needed for D3 force simulation
                target: this.submissions[link.submissionIdB].id, // needed for D3 force simulation
                value: link.normalized_score,
            };
        });

        // Create nodes field
        const nodes = [];
        for (let id in this.submissions) {
            const sub = this.submissions[id];
            nodes.push({
                id: sub.id,
                path: sub.path,
                group: sub.group,
                color: sub.color,
                isArchive: sub.isArchive,
            });
        }
        d3Format["nodes"] = nodes;

        return d3Format;
    }

    _assignGroups() {
        // map each submission id to a group
        const groupMap = this._getGroupMap();

        // find the number of groups
        let maxGroup = 0;
        for (let id in groupMap) {
            const group = groupMap[id];
            if (group > maxGroup) {
                maxGroup = group;
            }
        }

        // map each group to a color
        const getColor = d3
            .scaleSequential()
            .domain([0, maxGroup + 1])
            .interpolator(d3.interpolateRainbow);

        // assign groups and their colors to nodes
        for (let id in this.submissions) {
            const sub = this.submissions[id];
            const group = groupMap[id];
            sub.group = group;
            sub.color = getColor(group);
        }
    }

    _getGroupMap() {
        // create a map from node_id to node
        let groupMap = {};
        this.links.forEach((d) => {
            groupMap[d.submissionIdA] = null;
            groupMap[d.submissionIdB] = null;
        });

        // create a map from node.id to directly connected node.ids
        let linkMap = {};
        this.links.forEach((d) => {
            if (d.submissionIdA in linkMap) {
                linkMap[d.submissionIdA].push(d.submissionIdB);
            } else {
                linkMap[d.submissionIdA] = [d.submissionIdB];
            }

            if (d.submissionIdB in linkMap) {
                linkMap[d.submissionIdB].push(d.submissionIdA);
            } else {
                linkMap[d.submissionIdB] = [d.submissionIdA];
            }
        });

        let groupId = 0;
        let visited = new Set();
        let unseen = new Set(Object.keys(groupMap).map((id) => Number(id)));

        // visit all nodes
        while (unseen.size > 0) {
            // start with an unseen node
            let node = unseen.values().next().value;
            unseen.delete(node);

            // DFS for all reachable nodes, start with all directly reachable
            let stack = [node];
            while (stack.length > 0) {
                // take top node on stack
                let curNode = stack.pop();

                // visit it, give it a group
                visited.add(curNode);
                groupMap[curNode] = groupId;

                // add all directly reachable (and unvisited nodes) to stack
                let directlyReachable = linkMap[curNode].filter((n) =>
                    unseen.has(n)
                );
                stack = stack.concat(directlyReachable);

                // remove all directly reachable elements from unseen
                directlyReachable.forEach((n) => unseen.delete(n));
            }

            groupId++;
        }

        return groupMap;
    }
}

export default API;
